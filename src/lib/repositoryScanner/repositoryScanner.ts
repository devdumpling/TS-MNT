import ts from "typescript";
import fg from "fast-glob";
import path from "path";
import Graph from "graphology";

import { getInternalDependencies, extractComponentDetails } from "../helpers";

type NodeType = "component" | "utility" | "file" | "module";

interface BaseNode {
  type: NodeType;
}

interface ComponentNode extends BaseNode {
  type: "component" | "utility";
  name: string;
  filePath: string;
  imports: string[]; // Describes where we're importing from only (e.g. react)
  dependencies?: string[];
  hooks?: Set<string>;
  stateVariables?: Set<string>;
  incomingProps?: Set<string>;
  childProps?: Set<string>;
}

interface FileNode extends BaseNode {
  type: "file";
  filePath: string;
  imports?: string[];
  exports?: string[];
  lineCount?: number;
}

interface ModuleNode extends BaseNode {
  type: "module";
  name: string;
  isInternal: boolean;
}

interface ScannerOptions {
  filePatterns?: string[];
  ignorePatterns?: string[];
  internalPackages?: string[];
  customComponentIdentifier?: (node: ts.Node) => boolean;
}

export class RepositoryScanner {
  private readonly tsConfigFile: string;
  private readonly options: ScannerOptions;
  private rootDir: string;
  private ModuleGraph: Graph;

  constructor(tsConfigFile: string, options: ScannerOptions = {}) {
    this.tsConfigFile = tsConfigFile;
    this.options = options;
    this.rootDir = ".";
    this.ModuleGraph = new Graph();
  }

  async scanRepository(rootDir: string): Promise<Graph> {
    // Performance hack while implementing -- only scan once
    if (this.ModuleGraph.size > 0) {
      console.log("Returning cached module graph");
      return this.getModuleGraph();
    }

    this.rootDir = rootDir;
    const filePatterns = this.options.filePatterns ?? ["**/*.ts", "**/*.tsx"];
    const ignorePatterns = this.options.ignorePatterns ?? [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
    ];
    const options: fg.Options = {
      cwd: rootDir,
      absolute: true,
      ignore: ignorePatterns,
    };

    const tsFiles = await fg(filePatterns, options);

    const program = this.createProgram(tsFiles, rootDir);

    const components: ComponentNode[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        this.visitNodes(sourceFile, sourceFile, components);
      }
    }

    return this.getModuleGraph();
  }

  private getModuleGraph(): Graph {
    return this.ModuleGraph;
  }

  private visitNodes(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    components: ComponentNode[]
  ): void {
    if (
      ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      (ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isArrowFunction(node.initializer))
    ) {
      const componentName = this.getComponentName(node, sourceFile);
      // only process named nodes
      if (componentName) {
        // process the node and add it to the graph
        this.processNode(node, componentName, sourceFile);
      }
    }

    // must recurse for anonymous arrow functions
    ts.forEachChild(node, (childNode) => {
      this.visitNodes(sourceFile, childNode, components);
    });
  }

  private processNode(
    node: ts.Node,
    componentName: string,
    sourceFile: ts.SourceFile
  ): void {
    const type = this.isComponent(node) ? "component" : "utility";
    const filePath = sourceFile.fileName;
    const imports = this.getImports(sourceFile);
    const dependencies = getInternalDependencies(
      imports,
      this.rootDir,
      this.options.internalPackages
    );

    const component: ComponentNode = {
      type,
      name: componentName,
      filePath,
      imports,
      dependencies,
    };

    if (type === "component") {
      const { hooks, stateVariables, incomingProps, childProps } =
        extractComponentDetails(node, sourceFile);
      component.hooks = hooks;
      component.stateVariables = stateVariables;
      component.incomingProps = incomingProps;
      component.childProps = childProps;
    }

    // Create a unique key for the node
    const moduleGraphKey = `${componentName}:${filePath}`;
    this.ModuleGraph.mergeNode(moduleGraphKey, component);

    // TODO: Add edges to the graph -- note we probably want to do this in a separate pass
    // if (dependencies && dependencies.length > 0) {
    //   for (const dependency of dependencies) {
    //     this.ModuleGraph.mergeEdge(moduleGraphKey, dependency);
    //   }
    // }
  }

  private isComponent(node: ts.Node): boolean {
    const returnStatementOrArrowBody = this.getReturnStatementOrArrowBody(node);

    if (!returnStatementOrArrowBody) {
      return false;
    }

    let hasJSX = false;
    const checkForJSX = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        hasJSX = true;
      } else {
        ts.forEachChild(node, checkForJSX);
      }
    };

    checkForJSX(returnStatementOrArrowBody);
    return hasJSX;
  }

  // This is recursive because we need to handle both explicit returns and
  // implicit arrow function returns (for implicit we have to look at the function body)
  private getReturnStatementOrArrowBody(node: ts.Node): ts.Node | null {
    let resultNode: ts.Node | null = null;

    const visitNode = (node: ts.Node) => {
      if (ts.isReturnStatement(node)) {
        resultNode = node;
        return;
      } else if (ts.isArrowFunction(node) && node.body) {
        resultNode = node.body;
        return;
      }
      ts.forEachChild(node, visitNode);
    };

    visitNode(node);
    return resultNode;
  }

  private createProgram(filePaths: string[], rootDir: string): ts.Program {
    const config = ts.readConfigFile(this.tsConfigFile, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(this.tsConfigFile)
    );

    parsedConfig.options.rootDir = rootDir;
    parsedConfig.fileNames = filePaths;

    return ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
  }

  private getComponentName(
    node: ts.Node,
    sourceFile: ts.SourceFile
  ): string | undefined {
    if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
      return (
        node.name?.getText(sourceFile) ?? node.name?.escapedText.toString()
      );
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return undefined;
  }

  private getImports(sourceFile: ts.SourceFile): string[] {
    const imports: string[] = [];
    sourceFile.forEachChild((node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        imports.push(node.moduleSpecifier?.text || "UNKNOWN_IMPORT");
      }
    });
    return imports;
  }
}
