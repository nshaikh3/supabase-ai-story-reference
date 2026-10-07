import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { stagingBrowserConfiguration, verificationUrl } from '../../scripts/staging-contract.mjs';
const target=stagingBrowserConfiguration(JSON.parse(readFileSync(new URL('../../deployment/targets.json',import.meta.url),'utf8')),process.env);
async function recoverInvitedAccount(page:Page,request:APIRequestContext,email:string) {
  const since=Date.now();
  await page.goto('/forgot-password');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByRole('button',{name:'Send reset link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  let messageId='';
  await expect.poll(async()=>{
    const response=await request.get(`${target.testMailOrigin}/api/v1/search`,{params:{query:`to:"${email}"`},headers:{Authorization:target.mailAuthorization},maxRedirects:0});
    if(!response.ok())return false;
    const data=await response.json() as {messages:{ID:string;Subject:string;Created:string;To:{Address:string}[]}[]};
    messageId=data.messages.find(message=>/reset|recover/i.test(message.Subject)&&Date.parse(message.Created)>=since-2000&&message.To.some(recipient=>recipient.Address===email))?.ID??'';
    return /^[A-Za-z0-9-]+$/.test(messageId);
  },{timeout:60000}).toBe(true);
  const response=await request.get(`${target.testMailOrigin}/api/v1/message/${messageId}`,{headers:{Authorization:target.mailAuthorization},maxRedirects:0});
  if(!response.ok())throw new Error('Synthetic mailbox unavailable');
  const message=await response.json() as {Text:string};
  await page.goto(verificationUrl(message.Text,target));
  await expect(page).toHaveURL(`${target.appOrigin}/account`);
  // Recovery keeps PKCE in this browser; no administrator-created session.
  const cookies=(await page.context().cookies()).filter(cookie=>/^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a,b)=>a.name.localeCompare(b.name));
  expect(cookies.length).toBeGreaterThan(0);
  for(const cookie of cookies){expect(cookie.secure).toBe(true);expect(cookie.sameSite).toBe('Lax');}
  const encoded=cookies.map(cookie=>cookie.value).join('');
  if(!encoded.startsWith('base64-'))throw new Error('Unexpected SSR session encoding');
  return JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString()) as {access_token:string;user:{id:string}};
}
test('staging HTTPS, PKCE, two-owner isolation, generation and private images',async({browser,page,request})=>{
  const first=await page.goto('/');
  expect(first?.headers()['strict-transport-security']).toContain('max-age=31536000');
  expect(first?.headers()['content-security-policy']).toContain("'strict-dynamic'");
  await page.goto('/sign-up');await expect(page.getByRole('heading',{name:'Access by invitation'})).toBeVisible();
  const alice=await recoverInvitedAccount(page,request,target.identities[0]);
  const context=await browser.newContext({baseURL:target.appOrigin});const other=await context.newPage();
  const bob=await recoverInvitedAccount(other,request,target.identities[1]);
  const options=(token:string)=>({auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const owner=createClient(target.apiOrigin,target.publishableKey,options(alice.access_token)), outsider=createClient(target.apiOrigin,target.publishableKey,options(bob.access_token));
  let storyId:string|undefined, path:string|undefined;
  try {
    const created=await owner.from('stories').insert({title:`Staging ${randomUUID()}`,child_name:'Nova',prompt:'A fictional explorer learns to share a map.'}).select('id').single();
    expect(Boolean(created.error)).toBe(false);storyId=created.data?.id;expect(Boolean(storyId)).toBe(true);
    const hidden=await outsider.from('stories').select('id').eq('id',storyId!);expect(hidden.data).toEqual([]);
    const denied=await outsider.rpc('enqueue_generation',{p_story_id:storyId});expect(Boolean(denied.error)).toBe(true);
    for(const [token,status] of [[undefined,401],['forged.jwt.value',401],[bob.access_token,404]] as const){
      let response;
      try { response=await request.post(`${target.apiOrigin}/functions/v1/generate-story`,{headers:{apikey:target.publishableKey,...(token?{Authorization:`Bearer ${token}`}:{})},data:{story_id:storyId},timeout:30000,maxRedirects:0}); }
      catch { throw new Error('Staging Edge isolation request failed before an HTTP response'); }
      expect(response.status()).toBe(status);
    }
    await page.goto(`/stories/${storyId}`);await page.getByRole('button',{name:'Generate story',exact:true}).click();
    await expect(page.getByRole('region',{name:'Story pages'}).getByRole('heading',{name:/^Page /})).toHaveCount(5,{timeout:90000});
    await expect(page.getByRole('region',{name:'Generation history'})).toContainText('complete · mock');
    const pages=await owner.from('story_pages').select('page_number').eq('story_id',storyId!);expect(pages.data?.length).toBe(5);
    path=`${alice.user.id}/${storyId}/${randomUUID()}.png`;
    const asset=await owner.from('assets').insert({story_id:storyId,kind:'hero',storage_path:path,mime_type:'image/png'}).select('id').single();expect(Boolean(asset.error)).toBe(false);
    const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#27634f'}}).png().toBuffer();
    expect(Boolean((await owner.storage.from('story-assets').upload(path,bytes,{contentType:'image/png',upsert:false})).error)).toBe(false);
    expect(Boolean((await outsider.storage.from('story-assets').download(path)).error)).toBe(true);
    const image=await page.request.get(`${target.appOrigin}/assets/${asset.data!.id}`);expect(image.status()).toBe(200);expect(image.headers()['cache-control']).toContain('no-store');
    const privateImage=await other.request.get(`${target.appOrigin}/assets/${asset.data!.id}`);expect(privateImage.status()).toBe(404);
  } finally {
    if(path) { const removed=await owner.storage.from('story-assets').remove([path]);expect(Boolean(removed.error)).toBe(false); }
    if(storyId) { const removed=await owner.from('stories').delete().eq('id',storyId).select('id');expect(removed.data?.length).toBe(1); }
    await owner.auth.signOut({scope:'local'});await outsider.auth.signOut({scope:'local'});await context.close();
  }
});
