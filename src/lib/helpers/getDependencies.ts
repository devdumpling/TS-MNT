// imports is an array of strings, e.g. 'react', './src', etc
// TODO -- update to work with tsconfig internal paths as well
import type { ImportInfo } from "../types";

// internal packages is an array of packages considered "internal", e.g. @company/package
export function getInternalDependencies(
  imports: ImportInfo[],
  rootDir: string,
  internalPackages: string[] = [],
  ignoreExtensions: string[] = []
): string[] {
  return imports
    .map((importInfo) => importInfo.moduleSpecifier)
    .filter(
      (importedPath) =>
        importedPath.startsWith(".") ||
        importedPath.startsWith(rootDir) ||
        internalPackages.includes(importedPath)
    );
}
