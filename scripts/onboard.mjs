#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const install = process.argv.includes('--install');
const checkOnly = process.argv.includes('--check') || !install;
const exe = (name) => process.platform === 'win32' ? `${name}.cmd` : name;

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    // npm/npx/codex resolve to .cmd shims on Windows, which spawnSync cannot
    // exec directly (ENOENT/EINVAL) without going through a shell.
    shell: process.platform === 'win32',
    ...options,
  });
}

function commandWorks(command, args) {
  try { return run(command, args, { capture: true }).status === 0; } catch { return false; }
}

function heading(text) { console.log(`\n== ${text} ==`); }
function ok(text) { console.log(`  OK  ${text}`); }
function fail(text) { console.log(`  !!  ${text}`); }

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  fail(`Node ${process.versions.node} is too old. Install Node 22.13 or newer.`);
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
ok('config.json is valid');
mkdirSync(join(ROOT, 'data'), { recursive: true });

if (install) {
  heading('Install app dependencies');
  const deps = run(exe('npm'), ['install']);
  if (deps.status !== 0) process.exit(deps.status ?? 1);

  heading('Install browser used by the scraper');
  const browser = run(exe('npx'), ['playwright', 'install', 'chromium']);
  if (browser.status !== 0) process.exit(browser.status ?? 1);
}

heading('ChatGPT / Codex connection');
if (!commandWorks('codex', ['--version'])) {
  if (checkOnly) fail('Codex CLI is not installed. Run npm run onboard.');
  else {
    console.log('  Installing the official Codex CLI...');
    const added = run(exe('npm'), ['install', '-g', '@openai/codex']);
    if (added.status !== 0) process.exit(added.status ?? 1);
  }
}

if (commandWorks('codex', ['--version'])) {
  if (!commandWorks('codex', ['login', 'status'])) {
    if (checkOnly) fail('Codex is installed but not signed in. Run codex login.');
    else {
      console.log('  Your browser will open. Sign in with the ChatGPT account for this machine.');
      const login = run('codex', ['login']);
      if (login.status !== 0) process.exit(login.status ?? 1);
    }
  }
  if (commandWorks('codex', ['login', 'status'])) ok('Codex is signed in');
}

if (!existsSync(join(ROOT, 'node_modules'))) fail('Dependencies are missing. Run npm run onboard.');
else ok('App dependencies are installed');

if (install) {
  heading('Initialize local database');
  const init = run(process.execPath, ['cli.js', 'stats']);
  if (init.status !== 0) process.exit(init.status ?? 1);

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question('\nPair WhatsApp on this machine now? [Y/n] ')).trim().toLowerCase();
  rl.close();
  if (!answer || answer === 'y' || answer === 'yes') {
    heading('WhatsApp pairing');
    console.log('  On your phone: WhatsApp > Linked devices > Link a device, then scan the QR.');
    const pair = run(process.execPath, ['cli.js', 'whatsapp-pair']);
    if (pair.status !== 0) process.exit(pair.status ?? 1);
  } else console.log('  Skipped. Later run: npm run pair-whatsapp');

  console.log('\nSetup complete. Start with: npm run scrape');
} else {
  console.log('\nHealth check complete. Fix any !! items, then run npm run doctor again.');
}
