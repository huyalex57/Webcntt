import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', 'build']);

const STATIC_IMPORT_RE =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const HARDCODED_MODEL_RE =
  /\bgemini-(?:1\.5|2\.0|2\.5|3\.[0-9]|4)-(?:flash|pro|medium|neon|hydrogen|ultra)[a-z0-9.-]*/gi;

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function extractImportSpecifiers(content) {
  const specifiers = [];
  let match;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(content)) !== null) {
    const spec = match[1] || match[2] || match[3];
    if (spec) specifiers.push(spec);
  }
  return specifiers;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * Checks plug-and-play module import boundaries and anti-hardcode rules.
 * Returns a list of violations (empty array = clean).
 */
export function checkBoundaries(rootDir) {
  const violations = [];
  const aiReviewRoot = path.join(rootDir, 'packages', 'ai-review');
  const aiReviewSrc = path.join(aiReviewRoot, 'src');
  const apiSrc = path.join(rootDir, 'apps', 'api', 'src');
  const webSrc = path.join(rootDir, 'apps', 'web', 'src');
  const sharedSrc = path.join(rootDir, 'packages', 'shared', 'src');

  // 1. Inside packages/ai-review/src (excluding __tests__):
  //    - Cannot import apps/api, apps/web, @devstudy/api, or escape packages/ai-review
  //    - Cannot hardcode Gemini model IDs
  for (const file of walkFiles(aiReviewSrc)) {
    const rel = toPosix(path.relative(rootDir, file));
    if (rel.includes('/__tests__/')) continue;
    const content = fs.readFileSync(file, 'utf8');

    for (const spec of extractImportSpecifiers(content)) {
      const forbiddenHostImport =
        spec === '@devstudy/api' ||
        spec.startsWith('@devstudy/api/') ||
        spec.includes('apps/api') ||
        spec.includes('apps/web');

      let escapesPackage = false;
      if (spec.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), spec);
        const relToPkg = path.relative(aiReviewRoot, resolved);
        if (relToPkg.startsWith('..')) {
          escapesPackage = true;
        }
      }

      if (forbiddenHostImport || escapesPackage) {
        violations.push({
          rule: 'NO_MODULE_TO_CORE_IMPORT',
          file: rel,
          detail: `Module @devstudy/ai-review must not import host/external path "${spec}"`,
        });
      }
    }

    HARDCODED_MODEL_RE.lastIndex = 0;
    const modelMatches = content.match(HARDCODED_MODEL_RE);
    if (modelMatches) {
      violations.push({
        rule: 'NO_HARDCODED_LLM_MODEL',
        file: rel,
        detail: `Hardcoded LLM model ID detected (${[...new Set(modelMatches)].join(', ')}); must come from AI_REVIEW_LLM_MODEL env`,
      });
    }
  }

  // 2. Outside packages/ai-review (apps/api/src, apps/web/src, packages/shared/src):
  //    - No deep imports into @devstudy/ai-review/src, @devstudy/ai-review/dist, or packages/ai-review/src
  //    - Inside apps/api/src, ONLY apps/api/src/integrations/ai-review/** (and __tests__) may import @devstudy/ai-review
  //      and core modules must not import integrations/ai-review statically.
  for (const dir of [apiSrc, webSrc, sharedSrc]) {
    for (const file of walkFiles(dir)) {
      const rel = toPosix(path.relative(rootDir, file));
      const isIntegrationFile = rel.startsWith('apps/api/src/integrations/ai-review/');
      const isTestFile = rel.includes('/__tests__/');
      const content = fs.readFileSync(file, 'utf8');

      for (const spec of extractImportSpecifiers(content)) {
        if (
          spec.startsWith('@devstudy/ai-review/src') ||
          spec.startsWith('@devstudy/ai-review/dist') ||
          spec.includes('packages/ai-review/src') ||
          spec.includes('packages/ai-review/dist')
        ) {
          violations.push({
            rule: 'NO_DEEP_MODULE_IMPORT',
            file: rel,
            detail: `Deep import into @devstudy/ai-review internals is forbidden: "${spec}"`,
          });
        }

        if (
          rel.startsWith('apps/api/src/') &&
          !isIntegrationFile &&
          !isTestFile &&
          (spec === '@devstudy/ai-review' ||
            spec.startsWith('@devstudy/ai-review/') ||
            spec.includes('integrations/ai-review'))
        ) {
          violations.push({
            rule: 'NO_CORE_DIRECT_MODULE_IMPORT',
            file: rel,
            detail: `Core file must not import @devstudy/ai-review or integrations/ai-review directly: "${spec}"`,
          });
        }
      }
    }
  }

  return violations;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const violations = checkBoundaries(rootDir);

  if (violations.length > 0) {
    console.error(`❌ Module boundary check failed with ${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.file}: ${v.detail}`);
    }
    process.exit(1);
  }

  console.log('✅ Module boundary check passed (0 violations).');
}
