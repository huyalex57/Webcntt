import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const packageRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(packageRoot, '.env') });

const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma');
const downDir = path.join(packageRoot, 'prisma', 'down');
const dropSchemaSql = path.join(downDir, 'drop_schema.sql');

function assertIsolatedDatabaseUrl(): string {
  const dbUrl = process.env.AI_REVIEW_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('AI_REVIEW_DATABASE_URL is required for @devstudy/ai-review migrations');
  }
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error('AI_REVIEW_DATABASE_URL is not a valid URL');
  }
  const targetSchema = parsed.searchParams.get('schema');
  if (targetSchema !== 'ai_review') {
    throw new Error(
      `Refusing to run @devstudy/ai-review migration: AI_REVIEW_DATABASE_URL must specify ?schema=ai_review (got "${targetSchema ?? 'none'}")`
    );
  }
  return dbUrl;
}

function runPrisma(args: string[], dbUrl: string): void {
  execFileSync('npx', ['prisma', ...args], {
    cwd: packageRoot,
    env: { ...process.env, AI_REVIEW_DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
}

async function migrateUp(dbUrl: string): Promise<void> {
  console.log('[ai-review] Running migrate:up on schema "ai_review"...');
  runPrisma(['migrate', 'deploy', '--schema', schemaPath], dbUrl);
  console.log('[ai-review] migrate:up completed.');
}

async function migrateDown(dbUrl: string, dropAll: boolean): Promise<void> {
  if (dropAll) {
    console.log('[ai-review] Running migrate:down --all (tearing down schema "ai_review")...');
    if (!fs.existsSync(dropSchemaSql)) {
      throw new Error(`Missing teardown script: ${dropSchemaSql}`);
    }
    runPrisma(['db', 'execute', '--file', dropSchemaSql, '--schema', schemaPath], dbUrl);
    console.log('[ai-review] Schema "ai_review" dropped cleanly.');
    return;
  }

  // Roll back the latest applied migration
  const { PrismaClient } = await import('@ai-review/prisma-client');
  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const schemaCheck = await client.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ai_review'
      ) AS exists
    `;
    if (!schemaCheck[0]?.exists) {
      console.log('[ai-review] Schema "ai_review" does not exist; nothing to roll back.');
      return;
    }

    const applied = await client.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "ai_review"."_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY finished_at DESC, migration_name DESC
      LIMIT 1
    `;
    const latest = applied[0]?.migration_name;
    if (!latest) {
      console.log('[ai-review] No applied migrations found in "ai_review".');
      return;
    }

    const downFile = path.join(downDir, `${latest}.down.sql`);
    if (!fs.existsSync(downFile)) {
      throw new Error(`Rollback SQL not found for migration "${latest}": ${downFile}`);
    }

    console.log(`[ai-review] Rolling back migration "${latest}"...`);
    runPrisma(['db', 'execute', '--file', downFile, '--schema', schemaPath], dbUrl);
    console.log(`[ai-review] Rolled back "${latest}" cleanly.`);
  } finally {
    await client.$disconnect();
  }
}

async function main(): Promise<void> {
  const [command, flag] = process.argv.slice(2);
  const dbUrl = assertIsolatedDatabaseUrl();

  if (command === 'up') {
    await migrateUp(dbUrl);
    return;
  }
  if (command === 'down') {
    await migrateDown(dbUrl, flag === '--all');
    return;
  }

  console.error('Usage: tsx scripts/migrate.ts <up | down [--all]>');
  process.exit(1);
}

main().catch((err) => {
  console.error('[ai-review] Migration error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
