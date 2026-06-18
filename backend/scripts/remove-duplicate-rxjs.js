#!/usr/bin/env node
/**
 * Remove duplicate RxJS installations that cause TypeScript type conflicts
 * Run this after npm install in CI/CD environments
 */

const fs = require('fs');
const path = require('path');

const pathsToRemove = [
  // Remove RxJS from @angular-devkit nested node_modules
  'node_modules/@angular-devkit/core/node_modules/rxjs',
  'node_modules/@angular-devkit/schematics/node_modules/rxjs',
  // Remove RxJS from service-level node_modules
  'services/api-gateway/node_modules/rxjs',
  'services/auth-service/node_modules/rxjs',
  'services/suggestion-service/node_modules/rxjs',
  'services/history-service/node_modules/rxjs',
  'services/favorite-service/node_modules/rxjs',
];

console.log('🧹 Removing duplicate RxJS installations...\n');

let removedCount = 0;

pathsToRemove.forEach((relativePath) => {
  const fullPath = path.join(__dirname, '..', relativePath);

  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Removed: ${relativePath}`);
      removedCount++;
    } catch (error) {
      console.error(`❌ Failed to remove ${relativePath}:`, error.message);
    }
  }
});

if (removedCount === 0) {
  console.log('✨ No duplicate RxJS installations found');
} else {
  console.log(`\n✨ Removed ${removedCount} duplicate RxJS installation(s)`);
}
