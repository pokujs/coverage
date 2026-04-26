import type { Node, SourceLocation } from 'acorn';

export type WithLocation = Node & { loc: SourceLocation };

export type IdentifierNode = Node & { type: 'Identifier'; name: string };

export type LiteralNode = Node & {
  type: 'Literal';
  value: string | number | boolean | bigint | null | RegExp;
};

export type PrivateIdentifierNode = Node & {
  type: 'PrivateIdentifier';
  name: string;
};

export type MemberExpressionNode = Node & {
  type: 'MemberExpression';
  object: Node;
  property: Node;
};

export type VariableDeclaratorNode = Node & {
  type: 'VariableDeclarator';
  id: Node;
};

export type AssignmentExpressionNode = Node & {
  type: 'AssignmentExpression';
  left: Node;
};

export type PropertyNode = Node & {
  type: 'Property';
  key: Node;
  value: Node;
};

export type PropertyDefinitionNode = Node & {
  type: 'PropertyDefinition';
  key: Node;
  value: Node | null;
};

export type MethodDefinitionNode = Node & {
  type: 'MethodDefinition';
  key: Node;
};

export type FunctionNode = Node & {
  type:
    | 'FunctionDeclaration'
    | 'FunctionExpression'
    | 'ArrowFunctionExpression';
  id: Node | null;
  body: Node;
};

export type LogicalExpressionNode = Node & {
  type: 'LogicalExpression';
  left: Node;
  right: Node;
};

export type ConditionalExpressionNode = Node & {
  type: 'ConditionalExpression';
  test: Node;
  consequent: Node;
  alternate: Node;
};

export type AssignmentPatternNode = Node & {
  type: 'AssignmentPattern';
  left: Node;
  right: Node;
};

export type IfStatementNode = Node & {
  type: 'IfStatement';
  test: Node;
  consequent: Node;
  alternate: Node | null;
};

export type SwitchCaseNode = Node & {
  type: 'SwitchCase';
};

export type SwitchStatementNode = Node & {
  type: 'SwitchStatement';
  cases: SwitchCaseNode[];
};

export type LoopStatementNode = Node & {
  type:
    | 'ForStatement'
    | 'ForInStatement'
    | 'ForOfStatement'
    | 'WhileStatement'
    | 'DoWhileStatement';
  body: Node;
};

export type CatchClauseNode = Node & { type: 'CatchClause'; body: Node };

export type TryStatementNode = Node & {
  type: 'TryStatement';
  handler: CatchClauseNode | null;
};

export type TypedNode =
  | IdentifierNode
  | LiteralNode
  | PrivateIdentifierNode
  | MemberExpressionNode
  | VariableDeclaratorNode
  | AssignmentExpressionNode
  | PropertyNode
  | PropertyDefinitionNode
  | MethodDefinitionNode
  | FunctionNode
  | LogicalExpressionNode
  | ConditionalExpressionNode
  | AssignmentPatternNode
  | IfStatementNode
  | SwitchCaseNode
  | SwitchStatementNode
  | LoopStatementNode
  | CatchClauseNode
  | TryStatementNode;
