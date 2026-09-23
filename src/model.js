import { config } from './config.js';
import { callClaudeCli, cliAvailable as claudeAvailable } from './cliModel.js';
import { callCodexCli, codexAvailable } from './codexModel.js';

export function modelProvider() {
  return config.models?.provider ?? 'codex';
}

export function modelAvailable() {
  return modelProvider() === 'claude' ? claudeAvailable() : codexAvailable();
}

export function callModel(options) {
  return modelProvider() === 'claude' ? callClaudeCli(options) : callCodexCli(options);
}

export function modelLabel(model) {
  return `${modelProvider()}${model ? `/${model}` : ' (account default)'}`;
}
