// Acquire the five credited render inputs, never overwrite an existing file.
// --check is read-only and offline. Original audio is excluded from Git.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/prepare_audio.mjs [--check]');
const checkOnly = args.includes('--check');
const sources = JSON.parse(await readFile(path.join(project, 'audio-sources.json'), 'utf8'));
const publicDir = path.join(project, 'public');
function verify(bytes, source) {
  if (bytes.length !== source.bytes || createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    throw new Error(`Source changed or local file differs: ${source.file}. Review provenance; no file was overwritten.`);
  }
}
for (const source of sources) {
  if (!/^audio\/(bgm|sfx)\/[a-z0-9-]+\.mp3$/.test(source.file)) throw new Error('Unexpected manifest path');
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || url.hostname !== 'assets.mixkit.co') throw new Error('Unexpected asset origin');
  const destination = path.join(publicDir, source.file);
  try {
    verify(await readFile(destination), source);
    console.log(`Verified ${source.file}`);
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (checkOnly) throw new Error(`Missing ${source.file}; run without --check to download credited inputs.`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), redirect: 'error' });
  if (!response.ok) throw new Error(`Asset download failed: HTTP ${response.status} for ${source.file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verify(bytes, source);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: 'wx' });
  console.log(`Prepared ${source.file}`);
}
console.log('All five credited audio inputs match the production fingerprints.');
