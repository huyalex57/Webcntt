import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Mechanically verifies the Plug-and-Play guarantee:
 * Copies the monorepo into a clean temporary directory WITHOUT:
 *   - packages/ai-review/
 *   - apps/api/src/integrations/ai-review/
 *   - apps/api/src/__tests__/ai-review-integration.test.ts
 * Then verifies:
 *   1. `npm run check:boundaries` passes (0 violations)
 *   2. `npm run build` (`@devstudy/shared`, `@devstudy/api`, `@devstudy/web`) succeeds cleanly
 *   3. Core frontend tests (`@devstudy/web`) and core backend tests (`gemini-service`, `practice-core`) pass 100%.
 */
function copyWorkspaceTree(srcDir, destDir) {
  const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.turbo', 'coverage']);

  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    const rel = path.relative(rootDir, srcPath).split(path.sep).join('/');

    // Strip the plug-and-play module & its host integration folder completely
    if (
      rel === 'packages/ai-review' ||
      rel === 'apps/api/src/integrations/ai-review' ||
      rel === 'apps/api/src/__tests__/ai-review-integration.test.ts'
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      copyWorkspaceTree(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function linkNodeModules(srcDir, destDir) {
  const rootNm = path.join(srcDir, 'node_modules');
  const destNm = path.join(destDir, 'node_modules');
  if (fs.existsSync(rootNm) && !fs.existsSync(destNm)) {
    fs.symlinkSync(rootNm, destNm, 'dir');
  }

  for (const ws of ['apps/api', 'apps/web', 'packages/shared']) {
    const srcWsNm = path.join(srcDir, ws, 'node_modules');
    const destWsNm = path.join(destDir, ws, 'node_modules');
    if (fs.existsSync(srcWsNm) && !fs.existsSync(destWsNm)) {
      fs.symlinkSync(srcWsNm, destWsNm, 'dir');
    }
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devstudy-core-without-module-'));

try {
  console.log(`[core-without-module] Staging clean copy without @devstudy/ai-review at ${tmpDir}...`);
  copyWorkspaceTree(rootDir, tmpDir);
  linkNodeModules(rootDir, tmpDir);

  // Confirm the module is genuinely absent
  if (
    fs.existsSync(path.join(tmpDir, 'packages/ai-review')) ||
    fs.existsSync(path.join(tmpDir, 'apps/api/src/integrations/ai-review'))
  ) {
    throw new Error('Failed to exclude @devstudy/ai-review from staging copy');
  }

  const run = (cmd) => {
    console.log(`\n[core-without-module] $ ${cmd}`);
    execSync(cmd, {
      cwd: tmpDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        AI_REVIEW_ENABLED: 'false',
      },
    });
  };

  run('npm run check:boundaries');
  run('npm run build');
  run('npm run test --workspace=@devstudy/web');
  run('npm run test --workspace=@devstudy/api');

  console.log('\n✅ core-without-module verification PASSED: core builds and passes tests cleanly with @devstudy/ai-review removed.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
