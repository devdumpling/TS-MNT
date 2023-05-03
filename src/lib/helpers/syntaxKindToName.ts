import ts from "typescript";

// https://basarat.gitbook.io/typescript/overview/ast/ast-tip-syntaxkind
export function syntaxKindToName(kind: ts.SyntaxKind) {
  return (<any>ts).SyntaxKind[kind];
}
