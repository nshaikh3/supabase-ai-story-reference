import { spawnSync } from 'node:child_process';
import { loadConfig, localEnvironment, projectId, root, validateBindings } from './local-config.mjs';
export function localOperator() {
  loadConfig();
  const run = (command,args,input,timeout=20000) => {
    const result=spawnSync(command,args,{cwd:root,env:localEnvironment(process.env),input,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
    if(result.status!==0) throw new Error('Reference operator command failed; private output withheld.');
    return result.stdout;
  };
  const endpoint=process.env.DOCKER_HOST || run('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
  if(!endpoint.startsWith('unix://')) throw new Error('Reference operations require a local Docker Unix socket.');
  const container=`supabase_db_${projectId}`;
  validateBindings(JSON.parse(run('docker',['inspect',container])));
  const sql = input => run('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input).trim();
  const json = input => JSON.parse(sql(input));
  const localScript = action => run(process.execPath,['scripts/supabase-local.mjs',action],undefined,1800000);
  return {sql,json,localScript,run};
}
