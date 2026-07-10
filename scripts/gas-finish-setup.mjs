#!/usr/bin/env node
/**
 * GAS セットアップ完了後の検証と GitHub Secret 登録
 * Usage: node scripts/gas-finish-setup.mjs <WEB_APP_URL>
 */
import { execSync } from 'child_process';

const url = process.argv[2];
if (!url?.includes('script.google.com/macros/s/')) {
  console.error('Usage: node scripts/gas-finish-setup.mjs <WEB_APP_URL>');
  process.exit(1);
}

const health = await fetch(url, { redirect: 'follow' });
const text = await health.text();
console.log('Health check:', health.status);
console.log(text.slice(0, 200));

let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  console.error('Expected JSON health response. Web app may not be deployed yet.');
  process.exit(1);
}

if (!parsed.ok) {
  console.error('Health check failed:', parsed);
  process.exit(1);
}

if (!parsed.hasApiKey) {
  console.error('ANTHROPIC_API_KEY is not set in Script Properties.');
  process.exit(1);
}

execSync(
  `gh secret set VITE_GAS_ENDPOINT --repo nkhippo/English-Marker-Trainer --body ${JSON.stringify(url)}`,
  { stdio: 'inherit' },
);

console.log('GitHub secret VITE_GAS_ENDPOINT set. Triggering deploy workflow...');
execSync('gh workflow run "Deploy to GitHub Pages" --repo nkhippo/English-Marker-Trainer', {
  stdio: 'inherit',
});

console.log('Done. Check: https://nkhippo.github.io/English-Marker-Trainer/');
