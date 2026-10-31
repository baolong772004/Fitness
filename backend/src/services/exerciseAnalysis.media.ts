import { open } from 'node:fs/promises';
import path from 'node:path';
import type { Response, NextFunction } from 'express';
import { videoAvailable } from './exerciseAnalysis.utils.js';

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
