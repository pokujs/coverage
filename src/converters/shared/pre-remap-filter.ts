import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type {
  ResolvedScriptSource,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { fileFilter } from '../../file-filter.js';
import { resolveFilePath } from './v8-discovery.js';

export const passesPreRemapFilter = (
  script: V8ScriptCoverage,
  resolved: ResolvedScriptSource,
  preRemapFilter: ResolvedFileFilter,
  cwd: string
): boolean => {
  const transpiledPath = resolveFilePath(script.url, cwd);
  const preRemapPath =
    transpiledPath !== undefined
      ? transpiledPath
      : resolved.filePath !== ''
        ? resolved.filePath
        : undefined;
  if (preRemapPath === undefined) return true;
  return fileFilter.matches(preRemapFilter, preRemapPath, cwd);
};
