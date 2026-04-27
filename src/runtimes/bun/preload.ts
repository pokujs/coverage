import { FLUSH_MARKER } from './marker.js';

process.on('beforeExit', () => {
  process.stderr.write(`\n${FLUSH_MARKER}\n`);
});
