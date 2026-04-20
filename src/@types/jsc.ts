import type { FileAggregation } from './v8.js';

export type JscAggregationResult = {
  aggregations: Map<string, FileAggregation>;
  sources: Map<string, string>;
};

export type JscBasicBlock = {
  startOffset: number;
  endOffset: number;
  hasExecuted: boolean;
  executionCount: number;
};

export type JscScriptBlocks = {
  url: string;
  scriptId: string;
  source: string;
  blocks: JscBasicBlock[];
};

export type JscFunctionContainer = {
  nodeStart: number;
  nodeEnd: number;
  bodyStart: number;
  bodyEnd: number;
  name: string;
  isModuleFunction: boolean;
};

export type JscInspectorAttachInputs = {
  inspectorUrl: string;
  tempDir: string;
  testFile: string;
  cwd: string;
};

export type JscInspectorHandle = {
  close: () => void;
};

export type JscInspectorScriptInfo = {
  scriptId: string;
  url: string;
};

export type JscInspectorResponse = {
  id?: number;
  result?: {
    basicBlocks?: JscBasicBlock[];
    scriptSource?: string;
  };
  error?: {
    code: number;
    message: string;
  };
  method?: string;
  params?: Record<string, unknown>;
};

export type JscInspectorPendingResolver = (
  response: JscInspectorResponse
) => void;
