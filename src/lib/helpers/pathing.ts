import fs from "fs";
import path from "path";

export function isDirectory(p: string): boolean {
  return fs.existsSync(p) && fs.lstatSync(p).isDirectory();
}

export function getIndexFilePath(
  p: string,
  possibleExtensions: string[] = [".ts", ".tsx", ".js", ".jsx"]
): string | null {
  for (const ext of possibleExtensions) {
    const indexFilePath = path.join(p, `index${ext}`);
    if (fs.existsSync(indexFilePath)) {
      return indexFilePath;
    }
  }
  return null;
}
