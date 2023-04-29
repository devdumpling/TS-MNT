// imports is an array of strings, e.g. 'react', './src', etc
// TODO -- update to work with tsconfig internal paths as well
// internal packages is an array of packages considered "internal", e.g. @goodrx
export function getInternalDependencies(
  imports: string[],
  rootDir: string,
  internalPackages: string[] = []
): string[] {
  return imports.filter(
    (importedPath) =>
      importedPath.startsWith(".") ||
      importedPath.startsWith(rootDir) ||
      internalPackages.includes(importedPath)
  );
}
