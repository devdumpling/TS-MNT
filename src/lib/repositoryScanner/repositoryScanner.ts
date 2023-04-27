import ts from "typescript";
import fg from "fast-glob";
import path from "path";

interface Component {
  name: string;
  filePath: string;
}

export class RepositoryScanner {
  private readonly tsConfigFile: string;

  constructor(tsConfigFile: string) {
    this.tsConfigFile = tsConfigFile;
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
        ts.forEachChild(sourceFile, (node) => {
          if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
            const componentName = this.getComponentName(node);
            if (componentName) {
              components.push({
                name: componentName,
                filePath: sourceFile.fileName,
              });
            }
          }
        });
      }
    }

    return components;
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
    node: ts.ClassDeclaration | ts.FunctionDeclaration
  ): string | null {
    if (node.name) {
      return node.name?.escapedText?.toString() ?? node.name?.getText();
    }
    return null;
  }
}
