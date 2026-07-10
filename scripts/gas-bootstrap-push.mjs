#!/usr/bin/env node
/**
 * One-shot local bootstrap for GAS Script Properties (never commit with key).
 * Usage: node scripts/gas-bootstrap-push.mjs
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(
  process.env.HOME,
  'Library/Mobile Documents/com~apple~CloudDocs/thinkgrindai/backend/.env.local',
);

const envText = fs.readFileSync(envPath, 'utf8');
const keyLine = envText.split('\n').find((l) => l.startsWith('CLAUDE_API_KEY='));
if (!keyLine) throw new Error('CLAUDE_API_KEY not found');
const apiKey = keyLine.slice('CLAUDE_API_KEY='.length).trim().replace(/^["']|["']$/g, '');

const codePath = path.join(root, 'gas/code.gs');
const backupPath = path.join(root, 'gas/code.gs.bak');
const base = fs.readFileSync(backupPath, 'utf8');

const doGetBlock = `
function doGet(e) {
  if (e && e.parameter && e.parameter.bootstrap === 'marker-setup-once') {
    PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', ${JSON.stringify(apiKey)});
    return ContentService.createTextOutput('bootstrap-ok').setMimeType(ContentService.MimeType.TEXT);
  }
  return ContentService.createTextOutput(JSON.stringify(hasAnthropicApiKey())).setMimeType(ContentService.MimeType.JSON);
}
`;

const tail = base.slice(base.indexOf('function doOptions()'));
const out = base.slice(0, base.indexOf('function doOptions()')) + doGetBlock + '\n' + tail;
fs.writeFileSync(codePath, out);

execSync('clasp push --force', { cwd: root, stdio: 'inherit' });
execSync('clasp create-version "bootstrap"', { cwd: root, stdio: 'inherit' });
execSync(
  'clasp redeploy AKfycbyb4BIqs3tG5LILni3FbpchdqxORPLsMu5xkKRhmlGXfEYZ1dRUVxVBHmn7PF9b0nAgng --description "production web app"',
  { cwd: root, stdio: 'inherit' },
);

const url =
  'https://script.google.com/macros/s/AKfycbyb4BIqs3tG5LILni3FbpchdqxORPLsMu5xkKRhmlGXfEYZ1dRUVxVBHmn7PF9b0nAgng/exec?bootstrap=marker-setup-once';
const res = await fetch(url, { redirect: 'follow' });
const text = await res.text();
console.log('bootstrap status:', res.status, text.slice(0, 50));

fs.writeFileSync(codePath, base);
execSync('clasp push --force', { cwd: root, stdio: 'inherit' });
execSync('clasp create-version "clean"', { cwd: root, stdio: 'inherit' });
execSync(
  'clasp redeploy AKfycbyb4BIqs3tG5LILni3FbpchdqxORPLsMu5xkKRhmlGXfEYZ1dRUVxVBHmn7PF9b0nAgng --description "production web app"',
  { cwd: root, stdio: 'inherit' },
);

const health = await fetch(
  'https://script.google.com/macros/s/AKfycbyb4BIqs3tG5LILni3FbpchdqxORPLsMu5xkKRhmlGXfEYZ1dRUVxVBHmn7PF9b0nAgng/exec',
);
console.log('health:', await health.text());
