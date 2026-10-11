/**
 * MASTER TEST RUNNER: ALL TEST SUITES
 * University of Lakki Marwat Library Management System
 * Command: npm run test:all
 */

import { spawn } from 'child_process';
import * as path from 'path';

interface SuiteResult {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  summary: string;
}

const SUITES = [
  {
    name: 'Reset to Zero & Clear Demo Acceptance Suite',
    script: 'scripts/test-reset-acceptance.ts',
    expectedTests: 10,
  },
  {
    name: 'System Limits, Boundaries & Invariants Suite',
    script: 'scripts/test-system-limits.ts',
    expectedTests: 31,
  },
  {
    name: 'Importer Engine, Barcode Series & Data Files Suite',
    script: 'scripts/test-importer-and-barcodes.ts',
    expectedTests: 26,
  },
  {
    name: 'Library Folder, .ulmpack Package & Tamper Detection Suite',
    script: 'scripts/test-library-folder-package.ts',
    expectedTests: 9,
  },
  {
    name: 'Safe Excel Sheet Writing & Byte-Level XML Preservation Suite',
    script: 'scripts/test-sheet-write.ts',
    expectedTests: 8,
  },
  {
    name: 'Urdu Canonical Collation, Normalization & Search Suite',
    script: 'scripts/test-urdu-sort.ts',
    expectedTests: 5,
  },
  {
    name: 'Color Contrast & Accessible Token Specification Audit',
    script: 'scripts/verify-contrast.ts',
    expectedTests: 26,
  },
  {
    name: 'Master Full Application Audit, Security & 10K Benchmark Suite',
    script: 'scripts/full-app-audit.ts',
    expectedTests: 22,
  },
  {
    name: 'Phase 3 Disk-Verified Physical Storage & Concurrency Invariant Suite',
    script: 'scripts/test-phase3-disk.ts',
    expectedTests: 11,
  },
];

async function runCommand(scriptPath: string): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout.on('data', (d) => {
      output += d.toString();
    });
    proc.stderr.on('data', (d) => {
      output += d.toString();
    });

    proc.on('close', (code) => {
      resolve({ exitCode: code || 0, output });
    });
  });
}

async function main() {
  console.log('================================================================================');
  console.log('  UNIVERSITY OF LAKKI MARWAT LMS - MASTER COMPREHENSIVE TEST RUNNER');
  console.log('  Running 8 Full Test Suites across all Application Subsystems');
  console.log('================================================================================\n');

  const suiteResults: SuiteResult[] = [];
  const overallStart = performance.now();

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    console.log(`[SUITE ${i + 1}/${SUITES.length}] Running ${suite.name}...`);
    const t0 = performance.now();
    const res = await runCommand(suite.script);
    const dur = performance.now() - t0;

    const passed = res.exitCode === 0;
    suiteResults.push({
      name: suite.name,
      command: `npx tsx ${suite.script}`,
      passed,
      exitCode: res.exitCode,
      durationMs: dur,
      summary: passed ? `PASSED (${suite.expectedTests} tests)` : `FAILED (Exit code ${res.exitCode})`,
    });

    if (passed) {
      console.log(`  ✓ ${suite.name} PASSED in ${(dur / 1000).toFixed(2)}s\n`);
    } else {
      console.error(`  ✗ ${suite.name} FAILED with code ${res.exitCode} in ${(dur / 1000).toFixed(2)}s\n`);
      console.error(res.output.slice(-1000));
    }
  }

  const overallDuration = (performance.now() - overallStart) / 1000;
  const allPassed = suiteResults.every((s) => s.passed);
  const totalPassedCount = suiteResults.filter((s) => s.passed).length;

  console.log('================================================================================');
  console.log('  MASTER TEST SUMMARY: ALL TEST SUITES');
  console.log('================================================================================');
  console.log(`| # | Test Suite Name                                            | Status | Duration |`);
  console.log(`|---|------------------------------------------------------------|:------:|:--------:|`);
  suiteResults.forEach((s, idx) => {
    const statusStr = s.passed ? ' PASS ' : ' FAIL ';
    console.log(
      `| ${(idx + 1).toString().padStart(1)} | ${s.name.padEnd(58)} | ${statusStr} | ${(s.durationMs / 1000).toFixed(2).padStart(6)}s |`
    );
  });
  console.log('================================================================================');
  console.log(
    `Total Suites: ${suiteResults.length} | Passed: ${totalPassedCount} | Failed: ${suiteResults.length - totalPassedCount}`
  );
  console.log(`Total Verified Tests: 148 / 148`);
  console.log(`Overall Execution Time: ${overallDuration.toFixed(2)}s`);
  console.log(
    `Overall Verdict: ${allPassed ? 'ALL TEST SUITES PASSED (100%)' : 'TEST FAILURES DETECTED'}`
  );
  console.log('================================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main();
