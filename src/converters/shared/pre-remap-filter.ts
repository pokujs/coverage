import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type {
  ResolvedScriptSource,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { fileFilter } from '../../utils/file-filter.js';
import { v8Discovery } from './v8-discovery.js';

const passes = (
  script: V8ScriptCoverage,
  resolved: ResolvedScriptSource,
  resolvedFilter: ResolvedFileFilter,
  cwd: string
): boolean => {
  const transpiledPath = v8Discovery.resolveFilePath(script.url, cwd);
  const preRemapPath =
    transpiledPath !== undefined
      ? transpiledPath
      : resolved.filePath !== ''
        ? resolved.filePath
        : undefined;
  if (preRemapPath === undefined) return true;
  return fileFilter.matches(resolvedFilter, preRemapPath, cwd);
};

export const preRemapFilter = { passes } as const;
