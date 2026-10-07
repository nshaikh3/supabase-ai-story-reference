import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { localOperator } from './operator-local.mjs';
import { projectId, localEnvironment } from './local-config.mjs';
if(process.argv.length!==2) throw new Error('This fixed local regression accepts no arguments.');
const operator=localOperator(), owner=randomUUID();
function session(sql) {
  return new Promise(resolve=>{
    const child=spawn('docker',['exec','-i',`supabase_db_${projectId}`,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{env:localEnvironment(process.env),stdio:['pipe','pipe','pipe']});
    let error='';const timer=setTimeout(()=>child.kill('SIGTERM'),20000);
    child.stdout.resume();child.stderr.on('data',chunk=>{error+=chunk;});
    child.on('error',()=>{clearTimeout(timer);resolve('transport');});
    child.on('close',code=>{clearTimeout(timer);resolve(code===0?'admitted':error.includes('Resource limit reached')?'limited':'unexpected');});child.stdin.end(sql);
  });
}
try {
  operator.sql(`begin; insert into auth.users(id,email) values('${owner}','concurrency-${owner}@example.test'); insert into private.resource_usage(action,subject,window_start,used) values('story','${owner}',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',19); commit;`);
  const sql=`begin; set local statement_timeout='10s'; select set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}"}',true); set local role authenticated; insert into public.stories(title,child_name,prompt) values('Concurrency fixture','Nova','Fictional map'); select pg_sleep(0.1); commit;`;
  const result=await Promise.all(Array.from({length:4},()=>session(sql)));
  if(result.filter(v=>v==='admitted').length!==1||result.filter(v=>v==='limited').length!==3||operator.sql(`select count(*) from public.stories where owner_id='${owner}';`)!=='1'||operator.sql(`select used from private.resource_usage where action='story' and subject='${owner}';`)!=='20') throw new Error('Concurrent admission regression failed.');
  console.log('Concurrent authenticated SQL admission passed: one accepted at the boundary, three denied, no overshoot.');
} finally {
  operator.sql(`begin; delete from auth.users where id='${owner}'; delete from private.resource_usage where subject='${owner}'; commit;`);
}
