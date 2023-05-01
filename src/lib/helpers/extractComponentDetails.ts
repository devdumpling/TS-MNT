import ts from "typescript";

export function extractComponentDetails(node: ts.Node): {
  props: Set<string>;
  hooks: Set<string>;
  stateVariables: Set<string>;
} {
  const props = new Set<string>();
  const hooks = new Set<string>();
  const stateVariables = new Set<string>();

  function visit(node: ts.Node, parent?: ts.Node): void {
    // Extract props
    if (ts.isJsxAttribute(node)) {
      props.add(node.name.getText());
    } else if (
      ts.isParameter(node) &&
      parent &&
      (ts.isFunctionDeclaration(parent) || ts.isArrowFunction(parent))
    ) {
      const typeNode = node.type;
      if (typeNode && ts.isTypeLiteralNode(typeNode)) {
        const isFirstParameter = parent.parameters[0] === node;
        if (isFirstParameter) {
          typeNode.members.forEach((member) => {
            if (ts.isPropertySignature(member)) {
              if (member.name && ts.isIdentifier(member.name)) {
                props.add(member.name.escapedText.toString());
              }
            }
          });
        }
      }
    }

    // Extract hooks
    else if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        const expressionText = expression.escapedText.toString();
        if (
          expressionText.startsWith("React.use") ||
          expressionText.startsWith("use")
        ) {
          hooks.add(expressionText);
        }
      }
    }

    // Extract state
    //
    // Some ugly conditional logic:
    // effectively, we're looking only for variable declarations that are
    // initialized with a call to useState, and only those that are
    // array binding patterns.
    // I'm sure there's a cleaner way to do this with the TS AST.
    else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const initializerExpression = node.initializer.expression;
      if (
        ts.isIdentifier(initializerExpression) &&
        initializerExpression.escapedText.toString() === "useState"
      ) {
        if (ts.isArrayBindingPattern(node.name)) {
          node.name.elements.forEach((element) => {
            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
              stateVariables.add(element.name.escapedText.toString());
            }
          });
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, node));
  }

  visit(node);

  return { props, hooks, stateVariables };
}
