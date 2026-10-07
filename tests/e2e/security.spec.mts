import { test, expect } from '@playwright/test';
test('fresh document nonces, private headers and CSP-compatible hydration',async({page,request})=>{
  const violations:string[]=[];
  page.on('console',message=>{if(message.type()==='error'&&/content security policy|violates.*directive/i.test(message.text()))violations.push('Unexpected CSP violation');});
  await page.setExtraHTTPHeaders({'x-nonce':'caller-controlled','Content-Security-Policy':"script-src * 'unsafe-inline'"});
  const first=await page.goto('/');
  const policy=first?.headers()['content-security-policy']??'';
  expect(policy).toContain("'strict-dynamic'");expect(policy).not.toContain('caller-controlled');expect(policy).not.toContain('unsafe-');
  expect(first?.headers()['cache-control']).toContain('no-store');
  expect(first?.headers()['x-frame-options']).toBe('DENY');expect(first?.headers()['x-content-type-options']).toBe('nosniff');
  expect(first?.headers()['strict-transport-security']).toBeUndefined();
  const nonce=policy.match(/'nonce-([^']+)'/)?.[1];expect(nonce).toBeTruthy();
  const scripts=await page.locator('script').evaluateAll(nodes=>nodes.filter(node=>node.textContent?.includes('self.__next_f')||node.hasAttribute('src')).map(node=>(node as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);expect(scripts.every(value=>value===nonce)).toBe(true);
  const second=await request.get('/');expect(second.headers()['content-security-policy']).not.toBe(policy);
  await page.goto('/sign-up');await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeVisible();
  expect(violations).toEqual([]);
});
