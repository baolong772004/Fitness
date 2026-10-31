import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Packaged with Backend so sample detection also works without the AI development catalog.
const sampleHashes = new Map(Object.entries(JSON.parse(readFileSync(
  new URL('./exerciseAnalysis.sample-hashes.json', import.meta.url), 'utf8'))));

export function deriveVideoProvenance(bytes, input = {}, allowDataset = false, allowLegacy = false) {
  const origin = input.videoOrigin || 'USER_UPLOAD';
  const capture = input.captureMethodDeclared || 'UNKNOWN';
  const performer = input.performerDeclaration || 'UNKNOWN';
  if (![...['USER_UPLOAD', 'SAMPLE', 'DATASET'], ...(allowLegacy ? ['UNVERIFIED_LEGACY'] : [])].includes(origin) ||
      !['CAMERA', 'LIBRARY', 'UNKNOWN'].includes(capture) ||
      !['SELF_DECLARED', 'OTHER_PERSON', 'UNKNOWN'].includes(performer) ||
      (origin === 'DATASET' && !allowDataset)) throw new Error('INVALID_VIDEO_PROVENANCE');
  const videoSha256 = createHash('sha256').update(bytes).digest('hex');
  const sourceReference = sampleHashes.get(videoSha256) || null;
  const videoOrigin = sourceReference ? 'SAMPLE' : origin;
  return { videoOrigin, captureMethodDeclared: capture,
    performerDeclaration: videoOrigin === 'USER_UPLOAD' ? performer : 'UNKNOWN',
    videoSha256, sourceReference };
}
