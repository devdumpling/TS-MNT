import ts from "typescript";
import fg from "fast-glob";
import path from "path";

interface Component {
  type: "component" | "utility";
  name: string;
  filePath: string;
  imports: string[]; // Describes where we're importing from only (e.g. react)
}

interface ScannerOptions {
  filePatterns?: string[];
  ignorePatterns?: string[];
  customComponentIdentifier?: (node: ts.Node) => boolean;
}

export class RepositoryScanner {
  private readonly tsConfigFile: string;
  private readonly options: ScannerOptions;

  constructor(tsConfigFile: string, options: ScannerOptions = {}) {
    this.tsConfigFile = tsConfigFile;
    this.options = options;
  }

  async scanRepository(rootDir: string): Promise<Component[]> {
    const filePatterns = ["**/*.ts", "**/*.tsx"];
    const ignorePatterns = ["**/node_modules/**", "**/dist/**", "**/build/**"];
    const options: fg.Options = {
      cwd: rootDir,
      absolute: true,
      ignore: ignorePatterns,
    };

    const tsFiles = await fg(filePatterns, options);

    const program = this.createProgram(tsFiles, rootDir);

    const components: Component[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        this.visitNodes(sourceFile, sourceFile, components);
      }
    }

    return components;
  }

  private visitNodes(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    components: Component[]
  ): void {
    if (
      ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      (ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isArrowFunction(node.initializer))
    ) {
      const componentName = this.getComponentName(node);
      if (componentName) {
        components.push({
          type: this.isComponent(node) ? "component" : "utility",
          name: componentName,
          filePath: sourceFile.fileName,
          imports: this.getImports(sourceFile),
        });
      }
    }

    ts.forEachChild(node, (childNode) => {
      this.visitNodes(sourceFile, childNode, components);
    });
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

  private getComponentName(node: ts.Node): string | undefined {
    if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
      return node.name?.escapedText?.toString() ?? node.name?.getText();
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
