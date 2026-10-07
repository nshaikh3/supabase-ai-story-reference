import { readFileSync } from 'node:fs';
import { runStagingPreflight } from './staging-contract.mjs';
try {
  if(process.argv.length!==2) throw new Error('No target overrides are allowed.');
  const manifest=JSON.parse(readFileSync(new URL('../deployment/targets.json',import.meta.url),'utf8'));
  const checks=await runStagingPreflight(manifest,process.env);
  console.log(`Staging configuration preflight passed: ${checks.join('; ')}. Browser and operational verification are separate.`);
} catch { console.error('Staging preflight refused or failed. Check the configured target, scoped token and documented release criteria. No private response data printed.'); process.exitCode=1; }
