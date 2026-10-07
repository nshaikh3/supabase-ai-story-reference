import { constants, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { projectId, root } from './local-config.mjs';
import { localOperator } from './operator-local.mjs';
import { applyCleanup, digest, eligibleObject, rotateWorker, validateCleanupReport } from './operations-core.mjs';
const directory=join(root,'test-results/operations');
const reportPath=join(directory,'storage-cleanup.json');
const edgePath=join(root,'supabase/functions/.env');
const backupPath=join(directory,'worker-recovery.env');
const operations=new Set(['status','pause','resume','maintenance','cleanup-plan','cleanup-apply','worker-rotate']);
function privateRead(path) {
  const descriptor=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try { const stat=lstatSync(path); if(!stat.isFile()||(stat.mode&0o077)!==0) throw new Error('Operator files must be regular mode-0600 files.'); return readFileSync(descriptor,'utf8'); } finally { closeSync(descriptor); }
}
function privateWrite(path,content) {
  const temporary=`${path}.tmp`;
  writeFileSync(temporary,content,{mode:0o600,flag:'wx'}); renameSync(temporary,path);
}
// Values reaching fixed SQL below come from a digest-checked canonical report.
const literal=value=>value===null?'null':`'${value.replaceAll("'","''")}'`;
const objectQuery=`select coalesce(json_agg(q),'[]'::json) from (select o.bucket_id,o.id,o.name,o.owner_id,o.version,o.created_at,exists(select 1 from public.assets a where a.storage_path=o.name) attached,exists(select 1 from public.generation_jobs j where j.story_id::text=split_part(o.name,'/',2) and j.status in ('queued','generating') and j.lease_expires_at>clock_timestamp()) active from storage.objects o where o.bucket_id='story-assets'`;
try {
  const [action,...args]=process.argv.slice(2);
  if(!operations.has(action) || (action==='cleanup-apply' ? args.length!==1 || !/^[a-f0-9]{64}$/.test(args[0]) : args.length!==0)) throw new Error('Use a documented reference operation; arbitrary flags and targets are forbidden.');
  const report=action==='cleanup-apply' ? validateCleanupReport(privateRead(reportPath),args[0],projectId) : null;
  const operator=localOperator();
  mkdirSync(directory,{recursive:true,mode:0o700});
  if(lstatSync(directory).isSymbolicLink()) throw new Error('Operator report directory cannot be a symlink.');
  if(action==='status') {
    console.log(JSON.stringify(operator.json(`select json_build_object('controls',(select row_to_json(c) from private.resource_controls c),'stories',(select count(*) from public.stories),'active_images',(select count(*) from private.image_processing_leases where expires_at>clock_timestamp()),'active_generation',(select count(*) from private.generation_execution_leases where expires_at>clock_timestamp()),'daily_global_usage',(select coalesce(json_agg(u),'[]'::json) from (select action,used from private.resource_usage where subject='global' and window_start>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')u));`),null,2));
  } else if(action==='pause'||action==='resume') {
    if(action==='resume'&&existsSync(backupPath)) throw new Error('Resolve the private worker recovery file before resuming.');
    const enabled=action==='resume';
    operator.sql(`update private.resource_controls set initialized=true,writes_enabled=${enabled},generation_enabled=${enabled},uploads_enabled=${enabled},images_enabled=${enabled} where singleton;`);
    console.log(enabled?'Local reference admission resumed.':'Local reference admission paused; reads, deletion and in-flight completion remain available.');
  } else if(action==='maintenance') {
    operator.sql(`begin; delete from private.resource_usage where window_start < clock_timestamp()-interval '2 days'; delete from private.image_processing_leases where expires_at<=clock_timestamp(); delete from private.generation_execution_leases where expires_at<=clock_timestamp(); commit;`);
    console.log('Expired counters and leases removed; immutable path tombstones retained.');
  } else if(action==='cleanup-plan') {
    const rows=operator.json(`${objectQuery} and not exists(select 1 from public.assets a where a.storage_path=o.name) order by o.created_at,o.id limit 100)q;`);
    const candidates=rows.filter(row=>eligibleObject(row));
    const bytes=JSON.stringify({schemaVersion:1,target:projectId,createdAt:new Date().toISOString(),candidates},null,2)+'\n';
    privateWrite(reportPath,bytes);
    console.log(`Cleanup dry run: ${candidates.length} eligible, ${rows.length-candidates.length} excluded. No bytes deleted. Review test-results/operations/storage-cleanup.json; SHA-256 ${digest(bytes)}`);
  } else if(action==='cleanup-apply') {
    // Privileged control-plane credential is confined to this operator process.
    // Application and Edge clients continue to use publishable keys plus user JWTs.
    const raw=operator.localScript('env'); // Validate public configuration without printing CLI secrets.
    if(!raw.includes('Local public configuration ready')) throw new Error('Local configuration validation failed.');
    const status=JSON.parse(operator.run(join(root,'node_modules/.bin/supabase'),['status','--output','json','--workdir',root]));
    if(status.API_URL!=='http://127.0.0.1:55321'||typeof status.SERVICE_ROLE_KEY!=='string') throw new Error('Reference Storage operator credential unavailable.');
    const result=await applyCleanup(report,{
      claim:row=>operator.sql(`select private.claim_orphan_path(${literal(row.name)},${literal(row.id)}::uuid,${literal(row.version)});`)==='t',
      inspect:row=>operator.json(`${objectQuery} and o.name=${literal(row.name)})q;`)[0],
      remove:async name=>{
        const response=await fetch('http://127.0.0.1:55321/storage/v1/object/story-assets',{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[name]})});
        if(!response.ok) throw new Error('Storage cleanup failed; report retained and paths remain retired.');
      },
    });
    console.log(`Cleanup finished: ${result.removed} removed, ${result.skipped} skipped after rechecking.`);
  } else if(action==='worker-rotate') {
    if(existsSync(backupPath)) throw new Error('An unfinished rotation exists. Follow the worker recovery runbook.');
    const before=privateRead(edgePath), environment=parseEnv(before);
    if(!/^[a-f0-9]{64}$/.test(environment.GENERATION_WORKER_SECRET??'')) throw new Error('Invalid existing worker configuration.');
    const next=randomBytes(32).toString('hex');
    await rotateWorker({
      pause:()=>operator.sql(`begin; select generation_enabled from private.resource_controls where singleton for update; update private.resource_controls set generation_enabled=false where singleton; commit;`),
      drain:async()=>{
        const deadline=Date.now()+150000;
        while(operator.sql(`select count(*) from private.generation_execution_leases where expires_at>clock_timestamp();`)!=='0'){
          if(Date.now()>deadline) throw new Error('Generation did not drain; admission remains paused.');
          await new Promise(resolve=>setTimeout(resolve,2000));
        }
      },
      writeSecret:()=>{writeFileSync(backupPath,before,{mode:0o600,flag:'wx'});privateWrite(edgePath,before.replace(/^GENERATION_WORKER_SECRET=.*$/m,`GENERATION_WORKER_SECRET=${next}`));},
      restart:()=>{console.log('Recreating only the reference stack to load the new worker environment.');operator.localScript('stop');operator.localScript('start-core');},
      provision:()=>operator.localScript('generation-setup'),
      verify:()=>{
        const file=join(root,`supabase/.temp/start-secrets/supabase_edge_runtime_${projectId}/env/docker.env`);
        const loaded=parseEnv(privateRead(file));
        if(loaded.GENERATION_WORKER_SECRET!==next||operator.sql('select key_hash from private.generation_worker_key where singleton;')!==digest(next)) throw new Error('Worker configuration mismatch; generation remains paused.');
      },
      restore:prior=>operator.sql(`update private.resource_controls set generation_enabled=${prior==='t'} where singleton;`),
      finish:()=>unlinkSync(backupPath),
    });
    console.log('Worker rotation verified; prior generation admission state restored.');
  }
} catch { console.error('Reference operation failed. No secret-bearing error output was printed. Check the operations runbook; failed rotation keeps generation paused.'); process.exitCode=1; }
