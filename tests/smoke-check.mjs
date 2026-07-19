import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets/css/app.css',
  'assets/js/store.js',
  'assets/js/intelligence.js',
  'assets/js/ui.js',
  'assets/js/app.js',
  'assets/js/system.js',
  'assets/js/workflow.js',
  'assets/js/kernel.js',
  'assets/js/twin.js',
  'assets/js/state-engine.js',
  'assets/js/release-center.js',
  'assets/js/shell.js',
  'assets/js/simplify.js'
];

const failures = [];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`Missing ${relative}`);
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const view of ['today','mywork','fairs','talent','contacts','schedule','dayof','control','orchestration','oscenter','twin','stateengine','release']) {
  if (!html.includes(`id="view-${view}"`)) failures.push(`Missing view-${view}`);
}

if (!html.includes('assets/js/release-center.js',
  'assets/js/shell.js',
  'assets/js/simplify.js')) failures.push('Release Center script is not loaded.');

const store = fs.readFileSync(path.join(root, 'assets/js/store.js'), 'utf8');
if (!store.includes("oatf-os-production-v012")) failures.push('V0.11 storage key not found.');
if (!store.includes("version:'0.12'")) failures.push('V0.11 state version not found.');

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
if (!serviceWorker.includes('oatf-os-production-v012')) failures.push('V0.11 cache name not found.');
if (!serviceWorker.includes('release-center.js')) failures.push('Release Center missing from offline cache.');
if (!serviceWorker.includes('shell.js')) failures.push('Responsive shell missing from offline cache.');
if (!serviceWorker.includes('simplify.js')) failures.push('Simplified workflow missing from offline cache.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.version !== '0.12') failures.push('Manifest version is not 0.12.');

if (failures.length) {
  console.error('OATF OS V0.12 smoke check FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('OATF OS V0.12 smoke check PASSED');
console.log(`Validated ${requiredFiles.length} required files and 13 application views.`);
