import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  readFileSync(
    resolve(root, 'docs/design-system/reference/frozen-home-manifest.json'),
    'utf8',
  ),
);
const changed = [];
for (const [path, expected] of Object.entries(manifest.files)) {
  try {
    const actual = createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex');
    if (actual !== expected) {
      changed.push(path);
    }
  } catch {
    changed.push(path);
  }
}
if (changed.length) {
  console.error(
    'Frozen Home reference files changed. Review scope before proceeding:\n' +
      changed.join('\n'),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Frozen reference unchanged: ${
      Object.keys(manifest.files).length
    } files at ${manifest.sourceRevision}.`,
  );
}
