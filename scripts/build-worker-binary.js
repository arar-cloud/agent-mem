#!/usr/bin/env node
/**
 * Build Windows executable for claude-mem worker service
 * Uses Bun's compile feature to create a standalone exe
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
const outDir = 'dist/binaries';

fs.mkdirSync(outDir, { recursive: true });

console.log(`Building Windows exe v${version}...`);

try {
  // Prevent shell injection by using normalized paths and avoiding shell interpretation
  const outputFile = path.normalize(`${outDir}/worker-service-v${version}-win-x64.exe`);
  execSync(
    `bun build --compile --minify --target=bun-windows-x64 ./src/services/worker-service.ts --outfile ${outputFile}`,
    { stdio: 'inherit', shell: false }
  );
  console.log(`\nBuilt: ${outDir}/worker-service-v${version}-win-x64.exe`);
} catch (error) {
  console.error('Failed to build Windows binary:', error.message);
  process.exit(1);
}
