import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  loadReviewedMappingsCsv,
  parseAwesomeRoadmapsMarkdown,
  verifyLicenseFile,
  type IngestConfig,
  type NormalizedRoadmapSnapshot,
} from './parse.js';
import { loadRoadmapSnapshot } from './load.js';

const scriptDir = __dirname;
const repoRoot = path.resolve(scriptDir, '../..');
dotenv.config({ path: path.join(repoRoot, 'packages', 'ai-review', '.env') });

export class CommitVerificationError extends Error {
  readonly code = 'COMMIT_SHA_MISMATCH';
  constructor(message: string) {
    super(message);
    this.name = 'CommitVerificationError';
  }
}

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Shallow-fetches ONLY the exact pinned commit SHA into an isolated temp directory.
 * Strictly refuses if checked-out HEAD differs from `config.commitSha`.
 */
export function clonePinnedCommit(config: IngestConfig, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  runGit(['init', '--quiet'], targetDir);
  runGit(['remote', 'add', 'origin', config.repoUrl], targetDir);
  runGit(['fetch', '--depth', '1', 'origin', config.commitSha], targetDir);
  runGit(['checkout', '--quiet', 'FETCH_HEAD'], targetDir);

  const actualSha = runGit(['rev-parse', 'HEAD'], targetDir);
  if (actualSha !== config.commitSha) {
    throw new CommitVerificationError(
      `Checked-out commit SHA mismatch: expected ${config.commitSha}, got ${actualSha}`
    );
  }
}

export function verifyLocalRepoCommit(repoDir: string, expectedSha: string): void {
  const actualSha = runGit(['rev-parse', 'HEAD'], repoDir);
  if (actualSha !== expectedSha) {
    throw new CommitVerificationError(
      `Local repo commit SHA mismatch: expected ${expectedSha}, got ${actualSha}`
    );
  }
}

export interface RunIngestOptions {
  configPath?: string;
  localRepoDir?: string;
  skipCommitCheck?: boolean;
  parseOnly?: boolean;
  snapshotOutPath?: string;
  reviewedCsvPath?: string;
  databaseUrl?: string;
  prismaClient?: any;
}

export async function runIngest(options: RunIngestOptions = {}): Promise<{
  snapshot: NormalizedRoadmapSnapshot;
  loadResult?: Awaited<ReturnType<typeof loadRoadmapSnapshot>>;
}> {
  const configPath = options.configPath ?? path.join(scriptDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as IngestConfig;

  let workingRepoDir = options.localRepoDir;
  let shouldCleanup = false;

  if (!workingRepoDir) {
    workingRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devstudy-roadmap-ingest-'));
    shouldCleanup = true;
    console.log(`[roadmap-ingest] Fetching pinned commit ${config.commitSha} from ${config.repoUrl}...`);
    clonePinnedCommit(config, workingRepoDir);
  } else if (!options.skipCommitCheck && fs.existsSync(path.join(workingRepoDir, '.git'))) {
    verifyLocalRepoCommit(workingRepoDir, config.commitSha);
  }

  try {
    // 1. Verify LICENSE SHA-256 strictly before parsing/copying anything
    const verifiedLicenseSha = verifyLicenseFile(workingRepoDir, config);

    // 2. Parse README.md into normalized, schema-validated snapshot
    const readmePath = path.join(workingRepoDir, config.readmeFile);
    if (!fs.existsSync(readmePath)) {
      throw new Error(`Missing readme file "${config.readmeFile}" in ${workingRepoDir}`);
    }
    const markdown = fs.readFileSync(readmePath, 'utf8');
    const snapshot = parseAwesomeRoadmapsMarkdown(markdown, config, verifiedLicenseSha);

    if (options.snapshotOutPath) {
      fs.mkdirSync(path.dirname(options.snapshotOutPath), { recursive: true });
      fs.writeFileSync(options.snapshotOutPath, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(`[roadmap-ingest] Wrote snapshot to ${options.snapshotOutPath} (checksum=${snapshot.snapshotChecksum.slice(0, 12)})`);
    }

    if (options.parseOnly) {
      return { snapshot };
    }

    // 3. Load reviewed CSV mappings & upsert into ai_review DB inside one transaction
    const csvPath =
      options.reviewedCsvPath ?? path.join(scriptDir, 'mapping', 'reviewed-topic-tag-map.csv');
    const reviewedMappings = loadReviewedMappingsCsv(csvPath);

    let prisma = options.prismaClient;
    let ownsPrisma = false;

    if (!prisma) {
      const dbUrl = options.databaseUrl ?? process.env.AI_REVIEW_DATABASE_URL;
      if (!dbUrl) {
        throw new Error('AI_REVIEW_DATABASE_URL is required to load roadmap snapshot into DB');
      }
      const parsedUrl = new URL(dbUrl);
      if (parsedUrl.searchParams.get('schema') !== 'ai_review') {
        throw new Error('AI_REVIEW_DATABASE_URL must specify ?schema=ai_review');
      }

      const clientPath = path.join(
        repoRoot,
        'packages',
        'ai-review',
        'node_modules',
        '@ai-review',
        'prisma-client',
        'index.js'
      );
      const { PrismaClient } = await import(clientPath);
      prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      ownsPrisma = true;
    }

    try {
      const loadResult = await loadRoadmapSnapshot(prisma, snapshot, reviewedMappings);
      return { snapshot, loadResult };
    } finally {
      if (ownsPrisma) {
        await prisma.$disconnect();
      }
    }
  } finally {
    if (shouldCleanup && workingRepoDir) {
      fs.rmSync(workingRepoDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const parseOnly = args.includes('--parse-only');
  const localRepoDir = getArg('--local-repo');
  const snapshotOutPath = getArg('--snapshot-out') ?? path.join(scriptDir, 'snapshot.json');

  const result = await runIngest({
    localRepoDir,
    parseOnly,
    snapshotOutPath,
  });

  const totalTopics = result.snapshot.roadmaps.reduce((s, r) => s + r.topics.length, 0);
  const topLevelTopics = result.snapshot.roadmaps.reduce(
    (s, r) => s + r.topics.filter((t) => t.kind === 'topic').length,
    0
  );
  console.log(
    `[roadmap-ingest] Parsed ${result.snapshot.roadmaps.length} roadmaps, ${topLevelTopics} topics, ${totalTopics - topLevelTopics} subtopics (checksum=${result.snapshot.snapshotChecksum.slice(0, 12)}).`
  );
  if (result.loadResult) {
    console.log('[roadmap-ingest] DB load result:', result.loadResult);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[roadmap-ingest] FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
