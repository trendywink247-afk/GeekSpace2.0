#!/usr/bin/env node
/**
 * Run All Tests
 * Orchestrates full test suite: lint, typecheck, unit tests, E2E tests, smoke tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const CONFIG = {
  frontendPort: 5173,
  backendPort: 3001,
  testTimeout: 120000, // 2 minutes
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

async function runCommand(cmd, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data.toString());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data.toString());
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

async function waitForServer(url, maxAttempts = 30) {
  log(`Waiting for server at ${url}...`, 'yellow');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log('Server is ready!', 'green');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Server at ${url} did not start within ${maxAttempts} seconds`);
}

async function phase1_staticChecks() {
  logSection('PHASE 1: Static Checks (Lint + TypeCheck + Build)');

  // Root checks
  log('Running root lint...', 'blue');
  await runCommand('npm', ['run', 'lint'], rootDir);

  log('Running root typecheck...', 'blue');
  await runCommand('npm', ['run', 'typecheck'], rootDir);

  log('Running root build...', 'blue');
  await runCommand('npm', ['run', 'build'], rootDir);

  // Server checks
  log('Running server typecheck...', 'blue');
  await runCommand('npm', ['run', 'typecheck'], join(rootDir, 'server'));

  log('Running server build...', 'blue');
  await runCommand('npm', ['run', 'build'], join(rootDir, 'server'));

  log('Static checks passed!', 'green');
}

async function phase2_unitTests() {
  logSection('PHASE 2: Unit Tests');

  // Frontend unit tests
  log('Running frontend unit tests...', 'blue');
  await runCommand('npm', ['run', 'test'], rootDir);

  // Server unit tests
  log('Running server unit tests...', 'blue');
  await runCommand('npm', ['run', 'test'], join(rootDir, 'server'));

  log('Unit tests passed!', 'green');
}

async function phase3_e2eTests() {
  logSection('PHASE 3: E2E Tests (Playwright)');

  // Playwright will start the webServer automatically via playwright.config.ts
  log('Running Playwright E2E tests...', 'blue');
  await runCommand('npm', ['run', 'test:e2e'], rootDir, {
    TEST_MODE: '1',
    CI: 'true',
  });

  log('E2E tests passed!', 'green');
}

async function phase4_smokeTests() {
  logSection('PHASE 4: Smoke Tests');

  // Determine the base URL from environment or use default
  const apiUrl = process.env.API_URL || `http://localhost:${CONFIG.backendPort}`;

  log(`Running smoke tests against ${apiUrl}...`, 'blue');
  await runCommand('npm', ['run', 'smoke'], join(rootDir, 'scripts/smoke'), {
    API_URL: apiUrl,
  });

  log('Smoke tests passed!', 'green');
}

async function main() {
  const startTime = Date.now();
  const phases = [];

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipPhases = {
    static: args.includes('--skip-static'),
    unit: args.includes('--skip-unit'),
    e2e: args.includes('--skip-e2e'),
    smoke: args.includes('--skip-smoke'),
  };

  try {
    if (!skipPhases.static) {
      await phase1_staticChecks();
      phases.push({ name: 'Static Checks', status: 'passed' });
    }

    if (!skipPhases.unit) {
      await phase2_unitTests();
      phases.push({ name: 'Unit Tests', status: 'passed' });
    }

    if (!skipPhases.e2e) {
      await phase3_e2eTests();
      phases.push({ name: 'E2E Tests', status: 'passed' });
    }

    if (!skipPhases.smoke) {
      await phase4_smokeTests();
      phases.push({ name: 'Smoke Tests', status: 'passed' });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logSection('ALL TESTS PASSED');
    log(`Completed in ${duration}s`, 'green');
    log('\nExecuted phases:');
    phases.forEach(p => log(`  ✅ ${p.name}`, 'green'));

    process.exit(0);
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logSection('TESTS FAILED');
    log(`Error: ${err.message}`, 'red');
    log(`Failed after ${duration}s`, 'red');

    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
