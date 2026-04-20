import type {
  JscInspectorAttachInputs,
  JscInspectorHandle,
  JscInspectorPendingResolver,
  JscInspectorResponse,
  JscInspectorScriptInfo,
  JscScriptBlocks,
} from '../../@types/jsc.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slug } from '../../utils/strings.js';

const BLOCKS_FILE_SUFFIX = '.jsc.json';
const POLL_INTERVAL_MS = 50;
const STABLE_TICKS_TO_CLOSE = 6;

const isUserScript = (url: string, cwd: string): boolean => {
  if (!url) return false;
  if (url.startsWith('bun:')) return false;
  if (url.startsWith('node:')) return false;
  if (url.includes('/node_modules/')) return false;
  if (url.startsWith('file://'))
    return url.slice('file://'.length).startsWith(cwd);

  return url.startsWith(cwd);
};

const resolveUrlPath = (url: string): string =>
  url.startsWith('file://') ? url.slice('file://'.length) : url;

const attach = ({
  inspectorUrl,
  tempDir,
  testFile,
  cwd,
}: JscInspectorAttachInputs): JscInspectorHandle => {
  const socket = new WebSocket(inspectorUrl);
  const pending = new Map<number, JscInspectorPendingResolver>();
  const scripts: JscInspectorScriptInfo[] = [];
  const latestBlocks = new Map<string, JscScriptBlocks>();
  const sourceByScriptId = new Map<string, string>();

  let messageId = 0;
  let pollTimer: NodeJS.Timeout | null = null;
  let handshakeDone = false;
  let flushed = false;
  let closed = false;

  const send = (
    method: string,
    params: Record<string, unknown> = Object.create(null)
  ): Promise<JscInspectorResponse> =>
    new Promise((resolve) => {
      const id = ++messageId;

      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  const writeBlocks = (scriptBlocks: JscScriptBlocks): void => {
    const outputDir = join(tempDir, slug(testFile));
    const fileName = `${slug(resolveUrlPath(scriptBlocks.url))}${BLOCKS_FILE_SUFFIX}`;

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, fileName),
      JSON.stringify(scriptBlocks, null, 2)
    );
  };

  const fetchSource = async (scriptId: string): Promise<string> => {
    const cached = sourceByScriptId.get(scriptId);
    if (cached !== undefined) return cached;

    const response = await send('Debugger.getScriptSource', { scriptId });
    const scriptSource = response.result?.scriptSource ?? '';

    sourceByScriptId.set(scriptId, scriptSource);
    return scriptSource;
  };

  const captureNow = async (): Promise<void> => {
    if (!handshakeDone) return;

    for (const script of scripts) {
      if (!isUserScript(script.url, cwd)) continue;

      const blocksResponse = await send('Runtime.getBasicBlocks', {
        sourceID: script.scriptId,
      });

      if (blocksResponse.error) continue;
      if (!blocksResponse.result?.basicBlocks) continue;

      const scriptSource = await fetchSource(script.scriptId);

      latestBlocks.set(script.url, {
        url: script.url,
        scriptId: script.scriptId,
        source: scriptSource,
        blocks: blocksResponse.result.basicBlocks,
      });
    }
  };

  const flushLatest = (): void => {
    if (flushed) return;

    flushed = true;

    for (const [, scriptBlocks] of latestBlocks) {
      writeBlocks(scriptBlocks);
    }
  };

  const stopPolling = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data as string) as JscInspectorResponse;

    if (data.id !== undefined) {
      const resolver = pending.get(data.id);

      if (resolver) {
        pending.delete(data.id);
        resolver(data);
      }

      return;
    }

    if (data.method === 'Debugger.scriptParsed') {
      const parsedParams = data.params as
        | { scriptId?: string; url?: string }
        | undefined;

      if (parsedParams?.scriptId && typeof parsedParams.url === 'string')
        scripts.push({
          scriptId: parsedParams.scriptId,
          url: parsedParams.url,
        });
    }
  });

  let stableTicks = 0;
  let previousSignature = '';

  socket.addEventListener('open', async () => {
    await send('Runtime.enable');
    await send('Debugger.enable');
    await send('Runtime.enableControlFlowProfiler');
    await send('Inspector.enable');
    await send('Inspector.initialized');

    handshakeDone = true;

    pollTimer = setInterval(async () => {
      await captureNow().catch(() => {});

      const signature = Array.from(latestBlocks.entries())
        .map(
          ([url, scriptBlocks]) =>
            `${url}:${scriptBlocks.blocks.reduce((sum, block) => sum + block.executionCount, 0)}`
        )
        .join('|');

      if (signature && signature === previousSignature) {
        stableTicks += 1;

        if (stableTicks >= STABLE_TICKS_TO_CLOSE) {
          stopPolling();
          flushLatest();
          socket.close();
        }
      } else {
        stableTicks = 0;
        previousSignature = signature;
      }
    }, POLL_INTERVAL_MS);
  });

  socket.addEventListener('error', () => {});

  socket.addEventListener('close', () => {
    stopPolling();
    flushLatest();
  });

  const close = (): void => {
    if (closed) return;

    closed = true;

    try {
      socket.close();
    } catch {}
  };

  return { close };
};

export const jscInspector = { attach } as const;
