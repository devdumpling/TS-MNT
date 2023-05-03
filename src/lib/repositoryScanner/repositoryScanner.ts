import ts from "typescript";
import fg from "fast-glob";
import path from "path";
import Graph from "graphology";
import * as fs from "fs";

import {
  getInternalDependencies,
  extractComponentDetails,
  isDirectory,
  getIndexFilePath,
} from "../helpers";

import type {
  ScannerOptions,
  ComponentNode,
  ModuleNode,
  FileNode,
  BaseNode,
  UtilityNode,
  NodeType,
  ImportInfo,
} from "../types";

const DEFAULT_POSSIBLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export class RepositoryScanner {
  private readonly tsConfigFile: string;
  private readonly options: ScannerOptions;
  private rootDir: string;
  private ModuleGraph: Graph;
  private debug: boolean;

  constructor(tsConfigFile: string, options: ScannerOptions = {}) {
    this.tsConfigFile = tsConfigFile;
    this.options = options;
    this.rootDir = ".";
    this.ModuleGraph = new Graph();
    this.debug = options.debug ?? false;
  }

  async scanRepository(rootDir: string): Promise<Graph> {
    // Performance hack while implementing -- only scan once
    if (this.ModuleGraph.order > 0) {
      console.log("Graph already exists. Returning cached module graph");
      return this.getModuleGraph();
    }

    this.rootDir = rootDir;
    const filePatterns = this.options.filePatterns ?? ["**/*.ts", "**/*.tsx"];
    const ignorePatterns = [
      ...(this.options.ignorePatterns ?? []),
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

    // Recursively visit each node in the AST, adding each to our ModuleGraph
    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        this.visitNodes(sourceFile, sourceFile);
      }
    }

    // Draw edges between FileNodes
    const fileNodes = this.ModuleGraph.filterNodes(
      (node, attr) => attr.type === "file"
    );

    this.drawFileEdges(fileNodes);

    // Draw edges between ComponentNodes
    // this.drawComponentEdges(components);

    return this.getModuleGraph();
  }

  getModuleGraph(): Graph {
    return this.ModuleGraph;
  }

  private drawFileEdges(fileNodes: string[]): void {
    // If f_A imports f_B, then f_A depends on f_B
    // As such, we draw an edge e_AB from f_A to f_B
    for (const fileNode of fileNodes) {
      const fileNodeData = this.ModuleGraph.getNodeAttributes(fileNode);
      const fileImports = fileNodeData.imports ?? [];
      const fileDependencies = fileNodeData.dependencies ?? [];

      for (const importInfo of fileImports) {
        const dependencySpecifier = importInfo.moduleSpecifier;
        const dependencyPath = importInfo.moduleFullPath;

        // Only internal dependencies exist in fileDependencies
        if (fileDependencies.includes(dependencySpecifier)) {
          // Check to see if the dependency exists in the graph
          if (this.ModuleGraph.hasNode(dependencyPath)) {
            // If it does, we draw an edge from the fileNode to the dependency
            this.ModuleGraph.mergeDirectedEdgeWithKey(
              `${fileNode}->${dependencyPath}`,
              fileNode,
              dependencyPath
            );
          } else {
            if (this.debug) {
              console.warn("---------------------");
              console.warn(
                `Could not draw internal dep edge from ${fileNode} to ${dependencyPath} \n Dependency not found in graph: `,
                dependencyPath
              );
            }
            // Otherwise we assume this is a module dependency
            // and we create a new module node and draw an edge from the fileNode to the moduleNode
            const moduleNode: ModuleNode = {
              type: "module",
              filePath: dependencyPath ?? dependencySpecifier,
              name: dependencySpecifier,
              isInternal: true,
            };
            const moduleNodeKey = dependencyPath ?? dependencySpecifier;
            if (this.debug)
              console.log("Adding ModuleNode at key: ", moduleNodeKey);
            this.ModuleGraph.mergeNode(moduleNodeKey, moduleNode);
            if (this.debug)
              console.log(
                "Adding edge from fileNode to moduleNode: ",
                fileNode,
                moduleNodeKey
              );
            this.ModuleGraph.mergeDirectedEdgeWithKey(
              `${fileNode}->${moduleNodeKey}`,
              fileNode,
              moduleNodeKey
            );
            console.warn("---------------------");
          }
        }
      }
    }
  }

  private visitNodes(sourceFile: ts.SourceFile, node: ts.Node): void {
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
      const lineCount = node.getLineAndCharacterOfPosition(node.getEnd()).line;
      const imports = this.getImports(sourceFile);
      // TODO -- update this to ignore dependencies that match our ignore patterns
      const dependencies = getInternalDependencies(
        imports,
        this.rootDir,
        this.options.internalPackages
      );
      const fileNode: FileNode = {
        type: "file",
        filePath: node.fileName,
        name: path.basename(node.fileName),
        lineCount,
        imports,
        dependencies,
      };

      this.ModuleGraph.mergeNode(node.fileName, fileNode);
    }

    // must recurse for anonymous arrow functions
    ts.forEachChild(node, (childNode) => {
      this.visitNodes(sourceFile, childNode);
    });
  }

  private processNode(
    node: ts.Node,
    componentName: string,
    sourceFile: ts.SourceFile
  ): void {
    const type = this.identifyNode(node);
    const filePath = sourceFile.fileName;

    const baseNode: BaseNode = {
      type,
      name: componentName,
      filePath,
    };

    // TODO make this is a switch statement or rethink the processing
    if (type === "module") {
      const moduleNode: ModuleNode = {
        ...(baseNode as ModuleNode),
        // TODO check for isInternal
      };
      this.ModuleGraph.mergeNode(filePath, moduleNode);
    } else if (type === "utility") {
      const utilityNode: UtilityNode = {
        ...(baseNode as UtilityNode),
      };
      this.ModuleGraph.mergeNode(`${componentName}:${filePath}`, utilityNode);
    } else if (type === "component") {
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

  private getImports(sourceFile: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const possibleExtensions =
      this.options.possibleExtensions ?? DEFAULT_POSSIBLE_EXTENSIONS;

    ts.forEachChild(sourceFile, function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

        // Determine the full path of the import
        let moduleFullPath: string | undefined;

        if (
          moduleSpecifier.startsWith(".") ||
          moduleSpecifier.startsWith("/")
        ) {
          moduleFullPath = path.resolve(
            path.dirname(sourceFile.fileName),
            node.moduleSpecifier.getText(sourceFile).replace(/['"`]/g, "")
          );

          // If the path points to a directory with an index file, resolve the actual imported file path
          if (isDirectory(moduleFullPath)) {
            const indexFilePath = getIndexFilePath(
              moduleFullPath,
              possibleExtensions
            );

            if (indexFilePath) {
              moduleFullPath = indexFilePath;
            }
          }

          // Add file extension if it's missing (used for edge detection between files)
          if (!fs.existsSync(moduleFullPath)) {
            for (const ext of possibleExtensions) {
              if (fs.existsSync(moduleFullPath + ext)) {
                moduleFullPath = moduleFullPath + ext;
                break;
              }
            }
          }
        }

        let defaultImport: string | undefined;
        let namedImports: string[] | undefined;
        let namespaceImport: string | undefined;

        if (node?.importClause && ts.isImportClause(node.importClause)) {
          if (node.importClause.name) {
            defaultImport = node.importClause.name.text;
          }

          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              namedImports = node.importClause.namedBindings.elements.map(
                (element) => element.name.text
              );
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              namespaceImport = node.importClause.namedBindings.name.text;
            }
          }
        }

        imports.push({
          moduleSpecifier,
          moduleFullPath,
          defaultImport,
          namedImports,
          namespaceImport,
        });
      }

      ts.forEachChild(node, visit);
    });

    return imports;
  }
}
