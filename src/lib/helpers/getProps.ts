import ts from "typescript";

export function getProps(node: ts.Node): Set<string> {
  const props = new Set<string>();

  if (ts.isClassDeclaration(node)) {
    const renderMethod = node.members.find(
      (member) =>
        ts.isMethodDeclaration(member) && member.name.getText() === "render"
    ) as ts.MethodDeclaration | undefined;

    if (renderMethod && renderMethod.body) {
      renderMethod.body.forEachChild((childNode) => {
        if (ts.isJsxAttribute(childNode)) {
          props.add(childNode.name.getText());
        }
      });
    }
  } else if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
    const params = node.parameters;

    if (params.length === 1) {
      const propParam = params[0];
      if (ts.isObjectBindingPattern(propParam.name)) {
        propParam.name.elements.forEach((element) => {
          if (ts.isBindingElement(element)) {
            props.add(
              element.propertyName?.getText() || element.name.getText()
            );
          }
        });
      }
    }
  }

  return props;
}
