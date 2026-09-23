#!/usr/bin/env node
// Same reasoning as cli.js: shell:true is required for codex/claude/npm .cmd
// shims on Windows, and every arg we pass is our own -- never user input.
process.noDeprecation = true;
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

// Package downloads (npm installs, the Playwright/Codex binaries) are the
// single flakiest step on a fresh machine -- a dropped connection or an AV
// scan can corrupt or silently skip a download. One quiet retry clears most
// of these; a real failure still surfaces with a clear, actionable message.
function runRetryOrExit(command, args, { label } = {}) {
  let res = run(command, args);
  if (res.status !== 0) {
    console.log(`\n  That failed, retrying once (${label ?? command}) ...`);
    res = run(command, args);
  }
  if (res.status !== 0) {
    fail(`${label ?? command} failed twice. Check your internet connection, then run this command yourself: ${command} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
  return res;
}

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
  runRetryOrExit(exe('npm'), ['install'], { label: 'npm install' });

  heading('Install browser used by the scraper');
  runRetryOrExit(exe('npx'), ['playwright', 'install', 'chromium'], { label: 'playwright install chromium' });
}

heading('ChatGPT / Codex connection');
if (install && !commandWorks('codex', ['--version'])) {
  console.log('  Installing the official Codex CLI...');
  runRetryOrExit(exe('npm'), ['install', '-g', '@openai/codex'], { label: 'npm install -g @openai/codex' });

  // Known Windows issue: npm can exit 0 while silently failing to install
  // the platform-specific optional dependency, leaving a `codex` shim that
  // throws instead of running. One more reinstall usually clears it.
  if (!commandWorks('codex', ['--version'])) {
    console.log('  Codex installed but will not run yet -- reinstalling once more...');
    run(exe('npm'), ['install', '-g', '@openai/codex']);
  }
}

// A broken/unsigned-in Codex never blocks the rest of setup -- qualification
// and reply classification fall back to the local regex matcher without it,
// so WhatsApp pairing and everything else below should still proceed.
if (!commandWorks('codex', ['--version'])) {
  fail('Codex CLI is not installed or will not run. Continuing without it -- fix later with: npm install -g @openai/codex, then npm run doctor.');
} else {
  ok('Codex CLI installed');
  if (!commandWorks('codex', ['login', 'status'])) {
    if (checkOnly) fail('Codex is installed but not signed in. Run: codex login');
    else {
      console.log('  Your browser will open. Sign in with the ChatGPT account for this machine.');
      const login = run('codex', ['login']);
      if (login.status === 0 && commandWorks('codex', ['login', 'status'])) ok('Codex is signed in');
      else fail('Codex sign-in did not complete. Continuing without it -- fix later with: codex login');
    }
  } else {
    ok('Codex is signed in');
  }
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
