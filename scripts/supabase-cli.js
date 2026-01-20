#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const SUPABASE_VERSION = '1.190.0';

function canRun(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

const args = process.argv.slice(2);

try {
  run('supabase', args);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    if (canRun('pnpm')) {
      run('pnpm', ['dlx', `supabase@${SUPABASE_VERSION}`, ...args]);
      process.exit(0);
    }
    if (canRun('npx')) {
      run('npx', ['--yes', `supabase@${SUPABASE_VERSION}`, ...args]);
      process.exit(0);
    }
  }

  // eslint-disable-next-line no-console
  console.error('Failed to run Supabase CLI:', error);
  process.exit(1);
}
