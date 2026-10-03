import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { staticDocuments } from '../backend/src/catalog.mjs';
import { openapi } from '../backend/src/openapi.mjs';

const base = new URL('../dist/', import.meta.url);
const hashes = {};
const documents = { ...staticDocuments(), 'openapi.json': openapi };
for (const [name, document] of Object.entries(documents)) {
  const path = new URL(`api/v1/${name}`, base);
  await mkdir(new URL('.', path), { recursive: true });
  const text = JSON.stringify(document, null, 2) + '\n';
  await writeFile(path, text);
  hashes[name] = createHash('sha256').update(text).digest('hex');
}
await writeFile(new URL('api/v1/checksums.json', base), JSON.stringify(hashes, null, 2) + '\n');
await mkdir(new URL('runtime/', base), { recursive: true });
for (const file of ['geometry.mjs', 'flight.mjs', 'validation.mjs']) await copyFile(new URL(`../backend/src/${file}`, import.meta.url), new URL(`runtime/${file}`, base));
console.log(`Exported ${Object.keys(documents).length} JSON documents and browser-local runtime to dist/.`);
