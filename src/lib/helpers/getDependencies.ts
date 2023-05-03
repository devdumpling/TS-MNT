// TODO -- update to work with tsconfig internal paths as well
import type { ImportInfo } from "../types";

// internal packages is an array of packages considered "internal", e.g. @company/package
export function getInternalDependencies(
  imports: ImportInfo[],
  rootDir: string,
  internalPackages: string[] = [],
  internalPackagePrefix?: string, // e.g. @company
  ignoreExtensions: string[] = [] // e.g. ["scss", "css"]
): string[] {
  return imports
    .map((importInfo) => importInfo.moduleSpecifier)
    .filter(
      (importedPath) =>
        importedPath.startsWith(".") ||
        importedPath.startsWith(rootDir) ||
        internalPackages.includes(importedPath) ||
        (internalPackagePrefix &&
          importedPath.startsWith(internalPackagePrefix))
    );
}
