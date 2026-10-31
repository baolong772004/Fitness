import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { sendAnalysisVideo } from '../src/services/exerciseAnalysis.media.js';

test('private video delivery supports ranges, disables caching, and enforces expiry', async t => {
  const key = `${randomUUID()}.video`;
  const directory = path.resolve('private-exercise-media');
  const file = path.join(directory, key);
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.alloc(100, 7);
  bytes.write('ftyp', 4, 'ascii');
  await writeFile(file, bytes, { flag: 'wx' });
  const row = { mediaStorageKey: key, createdAt: new Date(), mediaDeletedAt: null };
  const app = express();
  app.get('/video', (_req, res, next) => void sendAnalysisVideo(row, res, next));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  });
  const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}/video`;
  const response = await fetch(endpoint, { headers: { Range: 'bytes=4-15' } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 4-15/100');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary') || '', /Authorization/i);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(4, 16));

  row.createdAt = new Date(Date.now() - 7 * 86400000);
  assert.equal((await fetch(endpoint)).status, 410);
  row.createdAt = new Date();
  await unlink(file);
  assert.equal((await fetch(endpoint)).status, 410);
  row.mediaStorageKey = '../outside.video';
  assert.equal((await fetch(endpoint)).status, 410);
});
