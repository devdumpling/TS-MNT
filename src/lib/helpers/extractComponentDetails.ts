import ts from "typescript";

export function extractComponentDetails(node: ts.Node): {
  props: Set<string>;
  hooks: Set<string>;
  stateVariables: Set<string>;
} {
  const props = new Set<string>();
  const hooks = new Set<string>();
  const stateVariables = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node)) {
      props.add(node.name.getText());
    } else if (ts.isCallExpression(node)) {
      const expressionText = node.expression.getText();
      if (
        expressionText.startsWith("React.use") ||
        expressionText.startsWith("use")
      ) {
        hooks.add(expressionText);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText() === "useState"
    ) {
      if (ts.isIdentifier(node.name)) {
        stateVariables.add(node.name.getText());
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(node);

  return { props, hooks, stateVariables };
}
