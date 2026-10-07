import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stagingBrowserConfiguration } from './scripts/staging-contract.mjs';
const manifest=JSON.parse(readFileSync(new URL('./deployment/targets.json',import.meta.url),'utf8'));
const target=stagingBrowserConfiguration(manifest,process.env);
export default defineConfig({
  testDir:'./tests/staging',workers:1,fullyParallel:false,retries:0,timeout:240000,
  globalSetup:'./tests/staging/preflight.mts',
  reporter:'list',outputDir:'test-results/staging',
  use:{baseURL:target.appOrigin,channel:process.env.CI?undefined:'chrome',trace:'off',screenshot:'off',video:'off',ignoreHTTPSErrors:false},
  expect:{timeout:30000},
});
