const pureTypeDeclarations: ReadonlySet<string> = new Set([
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSDeclareFunction',
  'TSImportEqualsDeclaration',
]);

const typeLiteralMembers: ReadonlySet<string> = new Set([
  'TSPropertySignature',
  'TSMethodSignature',
  'TSIndexSignature',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
]);

const functionLike: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

export const tsNodeKinds = {
  pureTypeDeclarations,
  typeLiteralMembers,
  functionLike,
} as const;
