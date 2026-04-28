import type { Node, Program } from 'acorn';
import type {
  IdentifierNode,
  TSExpressionWithTypeArgumentsNode,
  TSQualifiedNameNode,
  TSTypeQueryNode,
  TSTypeReferenceNode,
} from '../../@types/acorn-nodes.js';
import type { TypeReferenceVisitor } from '../../@types/type-coverage.js';
import { astWalk } from './ast-walk.js';

const headIdentifier = (node: Node): IdentifierNode | null => {
  if (node.type === 'Identifier') return node as IdentifierNode;
  if (node.type === 'TSQualifiedName') {
    const qualified = node as TSQualifiedNameNode;
    return headIdentifier(qualified.left);
  }
  return null;
};

const visit = (node: Node, head: Node, visitor: TypeReferenceVisitor): void => {
  const identifier = headIdentifier(head);

  if (identifier === null) return;
  if (node.loc === null || node.loc === undefined) return;

  visitor(identifier.name, node.loc.start.line);
};

const forEach = (program: Program, visitor: TypeReferenceVisitor): void => {
  astWalk.forEachNode(program, (node) => {
    if (node.type === 'TSTypeReference')
      visit(node, (node as TSTypeReferenceNode).typeName, visitor);
    else if (node.type === 'TSExpressionWithTypeArguments')
      visit(
        node,
        (node as TSExpressionWithTypeArgumentsNode).expression,
        visitor
      );
    else if (node.type === 'TSTypeQuery')
      visit(node, (node as TSTypeQueryNode).exprName, visitor);
  });
};

export const typeReferences = { forEach } as const;
