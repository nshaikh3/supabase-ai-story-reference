import { describe, expect, it, vi } from 'vitest';
import { runStagingPreflight, stagingBrowserConfiguration, stagingTarget, validateStagingPreflight, verificationUrl } from '../scripts/staging-contract.mjs';
const target={projectRef:'aaaaaaaaaaaaaaaaaaaa',projectName:'supabase-ai-story-reference-staging',appOrigin:'https://staging.example.com',testMailOrigin:'https://mail.example.com'};
const manifest={schemaVersion:1,staging:target,production:null};
const env={REFERENCE_STAGING_PROJECT_REF:target.projectRef,REFERENCE_STAGING_AUTHORIZATION:target.projectRef,REFERENCE_STAGING_MANAGEMENT_TOKEN:'sbp_fc_synthetic_only',REFERENCE_STAGING_EMAIL_A:'staging-11111111-1111-4111-8111-111111111111@example.test',REFERENCE_STAGING_EMAIL_B:'staging-22222222-2222-4222-8222-222222222222@example.test',REFERENCE_STAGING_PUBLISHABLE_KEY:'sb_publishable_synthetic',REFERENCE_STAGING_MAIL_AUTHORIZATION:'Basic c3ludGhldGljOmZpeHR1cmU='};
const fixture=()=>({project:{ref:target.projectRef,name:target.projectName,status:'ACTIVE_HEALTHY',database:{version:'17.11.0.002'}},auth:{site_url:target.appOrigin,uri_allow_list:`${target.appOrigin}/auth/callback`,disable_signup:true,mailer_autoconfirm:false,mailer_allow_unverified_email_sign_ins:false,external_anonymous_users_enabled:false,refresh_token_rotation_enabled:true,password_min_length:10,jwt_exp:3600,smtp_host:'smtp.example.com',rate_limit_email_sent:100,rate_limit_verify:100},realtime:{private_only:true,max_concurrent_users:100,max_channels_per_client:10,max_events_per_second:100,max_joins_per_second:100},storage:{fileSizeLimit:2097152,features:{imageTransformation:{enabled:false}}},buckets:[{id:'story-assets',public:false,file_size_limit:2097152,allowed_mime_types:['image/png','image/jpeg','image/webp']}]});
describe('separate staging handoff',()=>{
  it.each([{}, {...env,REFERENCE_STAGING_PROJECT_REF:'production'}, {...env,REFERENCE_STAGING_AUTHORIZATION:''}])('rejects unauthorized selection before network',async input=>{
    const request=vi.fn();await expect(runStagingPreflight(manifest,input,request)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
  });
  it('rejects unconfigured staging and legacy broad tokens before network',async()=>{
    const request=vi.fn();await expect(runStagingPreflight({...manifest,staging:null},env,request)).rejects.toThrow();
    await expect(runStagingPreflight(manifest,{...env,REFERENCE_STAGING_MANAGEMENT_TOKEN:'sbp_legacy'},request)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
  });
  it('requires separate scoped fictional mailboxes',()=>{
    expect(stagingTarget(manifest,env)).toEqual(target);expect(stagingBrowserConfiguration(manifest,env).identities).toHaveLength(2);
    for(const override of [{REFERENCE_STAGING_EMAIL_A:'real@example.com'},{REFERENCE_STAGING_EMAIL_B:env.REFERENCE_STAGING_EMAIL_A},{REFERENCE_STAGING_PUBLISHABLE_KEY:'sb_secret_bad'},{REFERENCE_STAGING_MAIL_AUTHORIZATION:''}])expect(()=>stagingBrowserConfiguration(manifest,{...env,...override})).toThrow();
  });
  it('checks project identity before reading service configuration',async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({ref:target.projectRef,name:'commercial'})));
    await expect(runStagingPreflight(manifest,env,request)).rejects.toThrow('identity mismatch');expect(request).toHaveBeenCalledTimes(1);
  });
  it('uses fixed authenticated read-only requests with redirects disabled',async()=>{
    const f=fixture(), values=[f.project,f.auth,f.realtime,f.storage,f.buckets];
    const request=vi.fn().mockImplementation(async()=>new Response(JSON.stringify(values.shift())));
    expect(await runStagingPreflight(manifest,env,request)).toHaveLength(4);
    expect(request).toHaveBeenCalledTimes(5);
    for(const [url,options] of request.mock.calls){expect(url).toContain(`https://api.supabase.com/v1/projects/${target.projectRef}`);expect(options.redirect).toBe('error');}
    expect(request.mock.calls[4][0]).toMatch(/query\/read-only$/);
  });
  it.each(['project','auth','realtime','storage','buckets'] as const)('rejects missing %s evidence',category=>{
    const f=fixture();expect(()=>validateStagingPreflight(target,{...f,[category]:{}})).toThrow();
  });
  it('rejects weak settings and leaked raw diagnostics',async()=>{
    const f=fixture();expect(()=>validateStagingPreflight(target,{...f,auth:{...f.auth,disable_signup:false}})).toThrow('Auth');
    expect(()=>validateStagingPreflight(target,{...f,buckets:[{...f.buckets[0],public:true}]})).toThrow('bucket');
    expect(()=>validateStagingPreflight(target,{...f,project:{...f.project,database:{version:'17.6'}}})).toThrow('17.11');
    const request=vi.fn().mockResolvedValue(new Response('private upstream response',{status:403}));await expect(runStagingPreflight(manifest,env,request)).rejects.toThrow('withheld');
  });
  it('validates both confirmation service and fixed callback origin',()=>{
    const good=`https://${target.projectRef}.supabase.co/auth/v1/verify?token=synthetic&type=recovery&redirect_to=${encodeURIComponent(`${target.appOrigin}/auth/callback`)}`;
    expect(verificationUrl(good,target)).toBe(good);
    for(const input of [good.replace(target.projectRef,'bbbbbbbbbbbbbbbbbbbb'),good.replace('staging.example.com','evil.example.com'),'http://evil.test/verify?token=synthetic'])expect(()=>verificationUrl(input,target)).toThrow();
  });
});
