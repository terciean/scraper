import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './config.js';

let available = null;

// On Windows, the globally installed `codex` command is a .cmd shim, which
// spawnSync cannot execute directly (ENOENT/EINVAL) without a shell.
const SHELL = process.platform === 'win32';

/** True only when Codex is installed and signed into a ChatGPT account. */
export function codexAvailable({ refresh = false } = {}) {
  if (!refresh && available !== null) return available;
  try {
    const version = spawnSync('codex', ['--version'], { encoding: 'utf8', shell: SHELL });
    const login = spawnSync('codex', ['login', 'status'], { encoding: 'utf8', shell: SHELL });
    available = version.status === 0 && login.status === 0;
  } catch {
    available = false;
  }
  return available;
}

/** Run one structured-output request through the locally authenticated Codex CLI. */
export function callCodexCli({ system, prompt, model, jsonSchema }) {
  const temp = mkdtempSync(join(tmpdir(), 'iim-codex-'));
  const outputPath = join(temp, 'response.txt');
  const schemaPath = join(temp, 'schema.json');

  try {
    const args = [
      'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral',
      '--ignore-rules', '--color', 'never', '--output-last-message', outputPath,
    ];
    if (model) args.push('--model', model);
    if (jsonSchema) {
      writeFileSync(schemaPath, JSON.stringify(jsonSchema));
      args.push('--output-schema', schemaPath);
    }
    args.push('-');

    const input = [
      'Follow these task instructions exactly. Do not use tools or inspect files.',
      '', 'SYSTEM INSTRUCTIONS:', system, '', 'INPUT:', prompt,
    ].join('\n');
    const res = spawnSync('codex', args, {
      cwd: ROOT, input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 180_000, shell: SHELL,
    });

    if (res.error) throw new Error(`Codex failed to start: ${res.error.message}`);
    if (res.status !== 0) {
      const detail = String(res.stderr || res.stdout || 'unknown error').trim().slice(-500);
      throw new Error(`Codex exited ${res.status}: ${detail}`);
    }
    const text = readFileSync(outputPath, 'utf8').trim();
    return jsonSchema ? JSON.parse(text) : text;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
