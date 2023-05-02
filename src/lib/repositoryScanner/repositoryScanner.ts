import ts from "typescript";
import fg from "fast-glob";
import path from "path";
import Graph from "graphology";

import { getInternalDependencies, extractComponentDetails } from "../helpers";

type NodeType = "component" | "utility" | "file" | "module";

type GraphNode = ComponentNode | UtilityNode | FileNode | ModuleNode;

interface BaseNode {
  type: NodeType;
  filePath: string;
  name: string;
  imports?: string[]; // Describes where we're importing from only (e.g. react)
  exports?: string[];
  dependencies?: string[];
}

interface ComponentNode extends BaseNode {
  type: "component";
  hooks?: Set<string>;
  stateVariables?: Set<string>;
  incomingProps?: Set<string>;
  childProps?: Set<string>;
}

interface UtilityNode extends BaseNode {
  type: "utility";
}

interface FileNode extends BaseNode {
  type: "file";
  lineCount?: number;
}

interface ModuleNode extends BaseNode {
  type: "module";
  isInternal?: boolean;
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
        console.log("Processing file: ", sourceFile.fileName);
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
    } else if (ts.isSourceFile(node)) {
      console.log("Found source file");
      const lineCount = node.getLineAndCharacterOfPosition(node.getEnd()).line;
      const fileNode: FileNode = {
        type: "file",
        filePath: node.fileName,
        name: path.basename(node.fileName),
        lineCount,
      };
      this.ModuleGraph.mergeNode(node.fileName, fileNode);
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
    const type = this.identifyNode(node);
    const filePath = sourceFile.fileName;
    const imports = this.getImports(sourceFile);
    const dependencies = getInternalDependencies(
      imports,
      this.rootDir,
      this.options.internalPackages
    );

    const baseNode: BaseNode = {
      type,
      name: componentName,
      filePath,
      imports,
      dependencies,
    };

    // TODO make this is a switch statement or rethink the processing
    if (type === "module") {
      console.log("Found module");
      const moduleNode: ModuleNode = {
        ...(baseNode as ModuleNode),
        // TODO check for isInternal
      };
      this.ModuleGraph.mergeNode(filePath, moduleNode);
    } else if (type === "utility") {
      console.log("Found utility");
      const utilityNode: UtilityNode = {
        ...(baseNode as UtilityNode),
      };
      this.ModuleGraph.mergeNode(`${componentName}:${filePath}`, utilityNode);
    } else if (type === "component") {
      console.log("Found component");
      const { hooks, stateVariables, incomingProps, childProps } =
        extractComponentDetails(node, sourceFile);

      const componentNode: ComponentNode = {
        ...(baseNode as ComponentNode),
        hooks,
        stateVariables,
        incomingProps,
        childProps,
      };

      const moduleGraphKey = `${componentName}:${filePath}`;
      this.ModuleGraph.mergeNode(moduleGraphKey, componentNode);
    }

    // Should never happen
    else {
      throw new Error(`Unknown node type: ${type}`);
    }
  }

  // TODO add module identity
  private identifyNode(node: ts.Node): NodeType {
    if (ts.isSourceFile(node)) {
      return "file";
    } else if (this.isComponent(node)) {
      return "component";
    } else if (ts.isModuleDeclaration(node)) {
      return "module";
    } else {
      return "utility";
    }
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
