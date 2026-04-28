export type PathTreeNode<TPayload> = {
  segment: string;
  isFile: boolean;
  children: PathTreeNode<TPayload>[];
  payload?: TPayload;
};

export type PathTreeWalkContext = {
  depth: number;
  prefix: string;
  isLast: boolean;
  decoratedName: string;
};

export type PathTreeVisitor<TPayload> = (
  node: PathTreeNode<TPayload>,
  context: PathTreeWalkContext
) => void;
