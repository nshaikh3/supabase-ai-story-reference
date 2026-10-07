import { createHash } from 'node:crypto';
export const canonicalPath = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:png|jpg|jpeg|webp)$/;
export const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
export function eligibleObject(row, now = Date.now()) {
  return row && row.bucket_id === 'story-assets' && canonicalPath.test(row.name) && uuid.test(row.id) &&
    row.owner_id === row.name.split('/')[0] && (row.version === null || (typeof row.version === 'string' && row.version.length <= 200)) &&
    Number.isFinite(Date.parse(row.created_at)) && Date.parse(row.created_at) <= now - 86400000 &&
    row.attached === false && row.active === false;
}
export function validateCleanupReport(bytes, expectedDigest, target, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest) || digest(bytes) !== expectedDigest) throw new Error('Cleanup report digest does not match.');
  const report = JSON.parse(bytes);
  if (report.schemaVersion !== 1 || report.target !== target || !Array.isArray(report.candidates) || report.candidates.length > 100 ||
      !Number.isFinite(Date.parse(report.createdAt)) || Date.parse(report.createdAt) > now || now-Date.parse(report.createdAt) > 3600000 ||
      report.candidates.some(row => !eligibleObject(row,now)) || new Set(report.candidates.map(row=>row.name)).size !== report.candidates.length) {
    throw new Error('Cleanup report is invalid, stale, duplicated or belongs to a different target.');
  }
  return report;
}
export async function applyCleanup(report, transport) {
  let removed=0, skipped=0;
  for (const row of report.candidates) {
    if (!await transport.claim(row)) { skipped++; continue; }
    // A permanent tombstone is established before the last identity check.
    const current = await transport.inspect(row);
    if (!eligibleObject(current) || current.id !== row.id || current.version !== row.version || current.name !== row.name) { skipped++; continue; }
    await transport.remove(row.name); // Throws on ambiguous/failed API outcome; report remains for review.
    removed++;
  }
  return { removed, skipped };
}
export async function rotateWorker(transport) {
  const prior = await transport.pause();
  // Every failure intentionally leaves new generation paused. The old environment
  // remains in a private recovery file until configuration verification succeeds.
  await transport.drain();
  await transport.writeSecret();
  await transport.restart();
  await transport.provision();
  await transport.verify();
  try {
    await transport.restore(prior);
    await transport.finish();
  } catch (error) {
    // A resume response can be uncertain; attempt to re-pause before returning.
    try { await transport.pause(); } catch { /* Operator must inspect status. */ }
    throw error;
  }
}
