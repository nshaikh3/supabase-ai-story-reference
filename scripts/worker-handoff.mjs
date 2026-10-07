import { randomBytes } from 'node:crypto';
import { mkdirSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { validateTargetManifest } from '../src/lib/deployment-targets.ts';
import { digest } from './operations-core.mjs';
import { root } from './local-config.mjs';
export function workerHandoff(manifest,env,secret=randomBytes(32).toString('hex')) {
  const targets=validateTargetManifest(manifest), selection=env.REFERENCE_RELEASE_ENV;
  if(!['staging','production'].includes(selection)) throw new Error('Choose a configured hosted reference environment.');
  const target=targets[selection];
  if(!target||env.REFERENCE_RELEASE_PROJECT_REF!==target.projectRef||env.REFERENCE_RELEASE_AUTHORIZATION!==target.projectRef||!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Release target must match the approved reference manifest.');
  const sql=`-- Target: ${target.projectName} (${target.projectRef}). Verify live identity before execution.\n-- Generation must stay paused until the matching Edge secret is deployed and verified.\nbegin;\nupdate private.resource_controls set generation_enabled=false where singleton;\ninsert into private.generation_worker_key(singleton,key_hash) values(true,'${digest(secret)}') on conflict(singleton) do update set key_hash=excluded.key_hash;\ncommit;\n`;
  return {target,environment:selection,edge:`AI_PROVIDER=mock\nGENERATION_WORKER_SECRET=${secret}\n`,sql};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    if(process.argv.length!==2)throw new Error('No arbitrary command arguments.');
    const bundle=workerHandoff(JSON.parse(readFileSync(join(root,'deployment/targets.json'),'utf8')),process.env);
    const directory=join(root,'test-results/worker-handoff');
    mkdirSync(directory,{recursive:true,mode:0o700});if(lstatSync(directory).isSymbolicLink())throw new Error('Invalid output directory.');
    for(const [file,content] of [['worker.env',bundle.edge],['provision.sql',bundle.sql],['target.json',JSON.stringify({schemaVersion:1,...bundle.target,environment:bundle.environment,status:'prepared-not-applied'},null,2)+'\n']])writeFileSync(join(directory,file),content,{mode:0o600,flag:'wx'});
    console.log('Private worker handoff prepared in test-results/worker-handoff. No hosted request or deployment was made. Verify live project identity, pause/drain generation and follow the operations runbook before applying.');
  } catch {console.error('Worker handoff refused or incomplete. Verify the approved target and use a fresh private output directory. No hosted request was made.');process.exitCode=1;}
}
