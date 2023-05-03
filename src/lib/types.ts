import type { Node as TSNode } from "typescript";

export type NodeType = "component" | "utility" | "file" | "module";

export type GraphNode = ComponentNode | UtilityNode | FileNode | ModuleNode;

export interface ImportInfo {
  moduleSpecifier: string;
  moduleFullPath?: string;
  defaultImport?: string;
  namedImports?: string[];
  namespaceImport?: string;
}

export interface BaseNode {
  type: NodeType;
  filePath: string;
  name: string;
  exports?: string[];
}

export interface ComponentNode extends BaseNode {
  type: "component";
  hooks?: Set<string>;
  stateVariables?: Set<string>;
  incomingProps?: Set<string>;
  childProps?: Set<string>;
}

export interface UtilityNode extends BaseNode {
  type: "utility";
}

export interface FileNode extends BaseNode {
  type: "file";
  imports?: ImportInfo[];
  dependencies?: string[];
  lineCount?: number;
}

export interface ModuleNode extends BaseNode {
  type: "module";
  isInternal?: boolean;
}

export interface ScannerOptions {
  filePatterns?: string[];
  ignorePatterns?: string[]; // Use this to override default ignore patterns (e.g. do not create nodes for these files)
  internalPackages?: string[];
  possibleExtensions?: string[];
  customComponentIdentifier?: (node: TSNode) => boolean;
  debug?: boolean;
}
