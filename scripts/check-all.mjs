#!/usr/bin/env node
/**
 * Check All Packages
 * Runs lint, typecheck, and build across all packages in the monorepo
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packages = [
  { name: 'root', path: '.' },
  { name: 'server', path: 'server' },
  { name: 'picoclaw', path: 'picoclaw' },
  { name: 'bridge/edith-bridge', path: 'bridge/edith-bridge' },
  { name: 'scripts/smoke', path: 'scripts/smoke' },
];

async function runCommand(cmd, args, cwd, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${name}] Running: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(`[${name}] ${data}`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(`[${name}] ${data}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function checkPackage(pkg) {
  const cwd = join(rootDir, pkg.path);
  const results = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking package: ${pkg.name}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Try to run lint
    try {
      await runCommand('npm', ['run', 'lint'], cwd, pkg.name);
      results.push({ script: 'lint', status: 'passed' });
    } catch (err) {
      results.push({ script: 'lint', status: 'failed', error: err.message });
    }

    // Try to run typecheck
    try {
      await runCommand('npm', ['run', 'typecheck'], cwd, pkg.name);
      results.push({ script: 'typecheck', status: 'passed' });
    } catch (err) {
      results.push({ script: 'typecheck', status: 'failed', error: err.message });
    }

    // Try to run build
    try {
      await runCommand('npm', ['run', 'build'], cwd, pkg.name);
      results.push({ script: 'build', status: 'passed' });
    } catch (err) {
      results.push({ script: 'build', status: 'failed', error: err.message });
    }

  } catch (err) {
    console.error(`Failed to check ${pkg.name}:`, err.message);
  }

  return results;
}

async function main() {
  console.log('Running checks across all packages...\n');

  const allResults = [];

  for (const pkg of packages) {
    const results = await checkPackage(pkg);
    allResults.push({ package: pkg.name, results });
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const { package: pkgName, results } of allResults) {
    console.log(`\n${pkgName}:`);
    for (const result of results) {
      const icon = result.status === 'passed' ? '✅' : '❌';
      console.log(`  ${icon} ${result.script}: ${result.status}`);
      if (result.status === 'failed') {
        totalFailed++;
      } else {
        totalPassed++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${totalPassed + totalFailed} checks | ✅ ${totalPassed} passed | ❌ ${totalFailed} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
