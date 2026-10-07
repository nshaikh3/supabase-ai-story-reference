import { readFileSync } from 'node:fs';
import { runStagingPreflight } from '../../scripts/staging-contract.mjs';
export default async function setup() {
  await runStagingPreflight(JSON.parse(readFileSync(new URL('../../deployment/targets.json',import.meta.url),'utf8')),process.env);
}
