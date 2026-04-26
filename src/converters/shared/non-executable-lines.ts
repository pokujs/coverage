import type { Node } from 'acorn';
import type { WithLocation } from '../../@types/acorn-nodes.js';
import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const PURE_TYPE_DECLARATION_TYPES: ReadonlySet<string> = new Set([
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSDeclareFunction',
  'TSImportEqualsDeclaration',
]);

const FUNCTION_LIKE_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const hasLocation = (node: Node): node is WithLocation =>
  node.loc !== null && node.loc !== undefined;

const markLineRange = (
  target: Set<number>,
  startLine: number,
  endLine: number
): void => {
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
    target.add(lineNumber);
  }
};

const isAmbientModuleDeclaration = (node: Node): boolean => {
  if (node.type !== 'TSModuleDeclaration') return false;
  return Reflect.get(node, 'declare') === true;
};

const isAmbientVariableDeclaration = (node: Node): boolean => {
  if (node.type !== 'VariableDeclaration') return false;
  return Reflect.get(node, 'declare') === true;
};

const isTypeOnlyImportDeclaration = (node: Node): boolean => {
  if (node.type !== 'ImportDeclaration') return false;
  return Reflect.get(node, 'importKind') === 'type';
};

const isPureTypeDeclaration = (node: Node): boolean => {
  if (PURE_TYPE_DECLARATION_TYPES.has(node.type)) return true;
  if (isAmbientModuleDeclaration(node)) return true;
  if (isAmbientVariableDeclaration(node)) return true;
  if (isTypeOnlyImportDeclaration(node)) return true;
  return false;
};

const collectFunctionHeaderLines = (
  target: Set<number>,
  functionNode: Node
): void => {
  if (!hasLocation(functionNode)) return;

  const body = Reflect.get(functionNode, 'body');
  if (body === null || body === undefined) return;
  if (typeof body !== 'object') return;
  if (!hasLocation(body as Node)) return;

  const headerStartLine = functionNode.loc.start.line;
  const bodyStartLine = (body as WithLocation).loc.start.line;

  if (bodyStartLine <= headerStartLine) return;

  markLineRange(target, headerStartLine + 1, bodyStartLine);
};

const find = (source: string): Set<number> => {
  const program = astCache.parse(source);
  if (program === null) return new Set();

  const nonExecutable = new Set<number>();

  astWalk.forEachNode(program, (node) => {
    if (!hasLocation(node)) return;

    if (isPureTypeDeclaration(node)) {
      markLineRange(nonExecutable, node.loc.start.line, node.loc.end.line);
      return;
    }

    if (FUNCTION_LIKE_TYPES.has(node.type)) {
      collectFunctionHeaderLines(nonExecutable, node);
    }
  });

  return nonExecutable;
};

export const nonExecutableLines = { find } as const;
