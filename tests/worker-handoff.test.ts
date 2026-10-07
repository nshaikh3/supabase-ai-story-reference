import { describe, expect, it } from 'vitest';
import { workerHandoff } from '../scripts/worker-handoff.mjs';
const staging={projectRef:'aaaaaaaaaaaaaaaaaaaa',projectName:'supabase-ai-story-reference-staging',appOrigin:'https://staging.example.com',testMailOrigin:null};
const manifest={schemaVersion:1,staging,production:null};
const env={REFERENCE_RELEASE_ENV:'staging',REFERENCE_RELEASE_PROJECT_REF:staging.projectRef,REFERENCE_RELEASE_AUTHORIZATION:staging.projectRef};
describe('protected worker deployment handoff',()=>{
  it('prepares fresh mock-only capability material and a hash-only SQL transaction',()=>{
    const secret='a'.repeat(64), bundle=workerHandoff(manifest,env,secret);
    expect(bundle.edge).toContain(secret);expect(bundle.sql).not.toContain(secret);expect(bundle.sql).toContain('generation_enabled=false');expect(bundle.target.projectRef).toBe(staging.projectRef);
    expect(workerHandoff(manifest,env).edge).not.toBe(workerHandoff(manifest,env).edge);
  });
  it.each([{}, {...env,REFERENCE_RELEASE_ENV:'local'}, {...env,REFERENCE_RELEASE_ENV:'production'}, {...env,REFERENCE_RELEASE_PROJECT_REF:'commercial'}, {...env,REFERENCE_RELEASE_AUTHORIZATION:''}])('refuses unapproved target %j',input=>expect(()=>workerHandoff(manifest,input)).toThrow());
});
