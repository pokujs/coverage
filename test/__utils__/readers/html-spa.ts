import type { HtmlSpaSnapshotNode } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { DomUtils, parseDocument } from 'htmlparser2';

const WINDOW_DATA_PATTERN =
  /window\.data\s*=\s*(\{[\s\S]*?\});\s*window\.generatedDatetime/;

const extract = (fixtureRoot: string): HtmlSpaSnapshotNode => {
  const indexHtml = readFileSync(`${fixtureRoot}/coverage/index.html`, 'utf8');

  const document = parseDocument(indexHtml);
  const scripts = DomUtils.findAll(
    (node) => node.tagName === 'script',
    DomUtils.getChildren(document)
  );

  for (const script of scripts) {
    const scriptText = DomUtils.textContent(script);
    const match = WINDOW_DATA_PATTERN.exec(scriptText);
    if (!match) continue;

    return JSON.parse(match[1]) as HtmlSpaSnapshotNode;
  }

  throw new Error(
    `window.data not found in ${fixtureRoot}/coverage/index.html`
  );
};

export const htmlSpa = {
  extract,
} as const;
