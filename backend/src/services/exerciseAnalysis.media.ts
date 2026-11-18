import { createHash, randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, open, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Response, NextFunction } from 'express';
import { videoAvailable } from './exerciseAnalysis.utils.js';

const mediaDir = path.resolve(process.cwd(), 'private-exercise-media');
const sampleDirs = [
  mediaDir,
  path.resolve(process.cwd(), '../ai-exercise-service/samples'),
  path.resolve(process.cwd(), '../ai-exercise-service/samples/debug'),
];

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function findMatchingVideoBySha256(targetSha256: string): Promise<string | null> {
  const normalized = targetSha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return null;
  for (const dir of sampleDirs) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!/\.(video|mp4|mov|webm)$/i.test(entry)) continue;
      const fullPath = path.join(dir, entry);
      try {
        const bytes = await readFile(fullPath);
        const digest = createHash('sha256').update(bytes).digest('hex').toLowerCase();
        if (digest === normalized) return fullPath;
      } catch {
        // Ignore unreadable candidate files
      }
    }
  }
  return null;
}

export async function ensureAnalysisVideoRestored(prisma: any, row: any): Promise<boolean> {
  if (!row) return false;
  if (typeof row.mediaStorageKey === 'string' && /^[0-9a-f-]{36}\.video$/i.test(row.mediaStorageKey) && !row.mediaDeletedAt) {
    const existingPath = path.join(mediaDir, row.mediaStorageKey);
    if (await fileExists(existingPath)) return true;
  }
  let sha256 = typeof row.videoSha256 === 'string' ? row.videoSha256 : '';
  if (!sha256 && typeof row.resultJson === 'string') {
    try {
      const parsed = JSON.parse(row.resultJson);
      sha256 = String(parsed?.inputVideoSha256 || parsed?.provenance?.videoSha256 || '');
    } catch {
      sha256 = '';
    }
  }
  if (!sha256) return false;
  const sourcePath = await findMatchingVideoBySha256(sha256);
  if (!sourcePath) return false;
  const newKey = `${randomUUID()}.video`;
  await mkdir(mediaDir, { recursive: true });
  await copyFile(sourcePath, path.join(mediaDir, newKey));
  if (prisma?.exerciseAnalysis?.update && row.id) {
    await prisma.exerciseAnalysis.update({
      where: { id: row.id },
      data: { mediaStorageKey: newKey, mediaDeletedAt: null },
    }).catch(() => undefined);
  }
  row.mediaStorageKey = newKey;
  row.mediaDeletedAt = null;
  return true;
}

// Call only after checking ownership or current, explicitly consented Coach access.
export async function sendAnalysisVideo(row: any, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  if (!videoAvailable(row)) return res.status(410).json({ success: false, message: 'Video đã hết hạn hoặc đã được xóa.' });
  const filename = path.resolve(process.cwd(), 'private-exercise-media', row.mediaStorageKey);
  try {
    const file = await open(filename, 'r');
    const header = Buffer.alloc(16);
    try { await file.read(header, 0, 16, 0); } finally { await file.close(); }
    res.type(header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ? 'video/webm' : 'video/mp4');
    return res.sendFile(filename, { cacheControl: false }, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return res.status(410).json({ success: false, message: 'Video không còn được lưu.' });
    next(error);
  }
}
