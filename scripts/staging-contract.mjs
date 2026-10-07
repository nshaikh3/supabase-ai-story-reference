import { validateTargetManifest } from '../src/lib/deployment-targets.ts';
export function stagingTarget(manifest, env) {
  const target=validateTargetManifest(manifest).staging;
  if(!target || env.REFERENCE_STAGING_PROJECT_REF!==target.projectRef || env.REFERENCE_STAGING_AUTHORIZATION!==target.projectRef) throw new Error('Select and explicitly authorize the configured staging reference target.');
  return target;
}
export function stagingBrowserConfiguration(manifest, env) {
  const target=stagingTarget(manifest,env);
  const identities=[env.REFERENCE_STAGING_EMAIL_A,env.REFERENCE_STAGING_EMAIL_B];
  if(!target.testMailOrigin || !identities.every(email=>/^staging-[a-f0-9-]{36}@example\.test$/.test(email??'')) || identities[0]===identities[1] ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.REFERENCE_STAGING_PUBLISHABLE_KEY??'') || !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(env.REFERENCE_STAGING_MAIL_AUTHORIZATION??'')) throw new Error('Staging requires two distinct synthetic invited identities, a test mailbox and publishable key.');
  return {...target,apiOrigin:`https://${target.projectRef}.supabase.co`,identities,publishableKey:env.REFERENCE_STAGING_PUBLISHABLE_KEY,mailAuthorization:env.REFERENCE_STAGING_MAIL_AUTHORIZATION};
}
export function verificationUrl(text,target) {
  const match=text.match(/https:\/\/[^\s<>]+\/auth\/v1\/verify\?[^\s<>]+/);
  if(!match) throw new Error('No confirmation link in synthetic email.');
  const url=new URL(match[0].replaceAll('&amp;','&'));
  if(url.origin!==`https://${target.projectRef}.supabase.co` || url.pathname!=='/auth/v1/verify' || url.searchParams.get('redirect_to')!==`${target.appOrigin}/auth/callback`) throw new Error('Refusing a confirmation link outside the staging reference.');
  return url.toString();
}
const bounded=(value,max)=>Number.isInteger(value)&&value>0&&value<=max;
export function validateStagingPreflight(target,{project,auth,realtime,storage,buckets}) {
  const failures=[];
  if(project.ref!==target.projectRef || project.name!==target.projectName || project.status!=='ACTIVE_HEALTHY') failures.push('project identity/health');
  const version=/^17\.(\d+)(?:\.|$)/.exec(project.database?.version??'');
  if(!version||Number(version[1])<11) failures.push('Postgres 17.11+');
  if(auth.site_url!==target.appOrigin || auth.uri_allow_list!==`${target.appOrigin}/auth/callback` || auth.disable_signup!==true || auth.mailer_autoconfirm!==false || auth.mailer_allow_unverified_email_sign_ins!==false || auth.external_anonymous_users_enabled!==false || auth.refresh_token_rotation_enabled!==true || (!Number.isInteger(auth.password_min_length)||auth.password_min_length<10) || !bounded(auth.jwt_exp,3600)) failures.push('Auth/redirect policy');
  if(typeof auth.smtp_host!=='string' || !auth.smtp_host || !bounded(auth.rate_limit_email_sent,100) || !bounded(auth.rate_limit_verify,100)) failures.push('SMTP/Auth rate limits');
  if(realtime.private_only!==true || !bounded(realtime.max_concurrent_users,100) || !bounded(realtime.max_channels_per_client,10) || !bounded(realtime.max_events_per_second,100) || !bounded(realtime.max_joins_per_second,100)) failures.push('private Realtime/traffic limits');
  if(!bounded(storage.fileSizeLimit,2097152) || storage.features?.imageTransformation?.enabled!==false) failures.push('Storage global limits');
  const bucket=Array.isArray(buckets)&&buckets.length===1?buckets[0]:null;
  if(!bucket || bucket.id!=='story-assets' || bucket.public!==false || Number(bucket.file_size_limit)!==2097152 || JSON.stringify(bucket.allowed_mime_types?.slice().sort())!==JSON.stringify(['image/jpeg','image/png','image/webp'])) failures.push('private story bucket');
  if(failures.length) throw new Error(`Staging preflight failed: ${failures.join(', ')}.`);
  return ['project identity and runtime','Auth/redirect/SMTP policy','private Realtime limits','private Storage limits'];
}
export async function runStagingPreflight(manifest,env,request=fetch) {
  const target=stagingTarget(manifest,env);
  const token=env.REFERENCE_STAGING_MANAGEMENT_TOKEN;
  if(!/^sbp_fc[A-Za-z0-9_-]+$/.test(token??'')) throw new Error('A project-scoped Management API token is required.');
  const api=`https://api.supabase.com/v1/projects/${target.projectRef}`;
  const call=async(path,query)=>{
    const response=await request(`${api}${path}`,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(query?{body:JSON.stringify({query})}:{})});
    if(!response.ok) throw new Error('Staging preflight request failed; credentials and response contents withheld.');
    return response.json();
  };
  // Identity is verified before querying the selected project's configuration.
  const project=await call('');
  if(project.ref!==target.projectRef||project.name!==target.projectName) throw new Error('Staging project identity mismatch.');
  const auth=await call('/config/auth'),realtime=await call('/config/realtime'),storage=await call('/config/storage');
  const buckets=await call('/database/query/read-only',"select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='story-assets';");
  return validateStagingPreflight(target,{project,auth,realtime,storage,buckets});
}
