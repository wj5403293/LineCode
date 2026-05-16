#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_SHA256) {
  console.error('Set ADMIN_PASSWORD or ADMIN_PASSWORD_SHA256 before starting the manager.');
  process.exit(1);
}

const children = [
  spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    env: { ...process.env, PORT: process.env.PORT || '3737' },
    stdio: 'inherit',
  }),
  spawn(process.execPath, [viteBin, '--host', '127.0.0.1'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  }),
];

let closing = false;
function close(signal = 'SIGTERM') {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => close(signal));
}

for (const child of children) {
  child.on('exit', code => {
    close();
    if (code && code !== 0) process.exitCode = code;
  });
}

