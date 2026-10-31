// Creates a fresh LOCAL test database, runs migrations/tests, then removes only that database.
// Run from backend: node tests/run-exercise-isolated.mjs
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const applicationUrl = process.env.DATABASE_URL || '';
const local = /^sqlserver:\/\/(localhost|127\.0\.0\.1)(?=[:;\\])/i.test(applicationUrl);
if (!local || !/;database=[^;]+/i.test(applicationUrl)) {
  throw new Error('This runner requires a localhost SQL Server URL with an explicit database. No database was changed.');
}
const database = `fitness_exercise_test_${randomBytes(8).toString('hex')}`;
if (!/^fitness_exercise_test_[a-f0-9]{16}$/.test(database)) throw new Error('Invalid isolated database name');
const withDatabase = name => applicationUrl.replace(/;database=[^;]+/i, `;database=${name}`);
const testUrl = withDatabase(database);
const admin = new PrismaClient({ datasourceUrl: withDatabase('master') });
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE [${database}]`);
  created = true;
  console.log(`Created isolated local database ${database}`);
  const env = { ...process.env, DATABASE_URL: testUrl, PT_TEST_DATABASE_URL: testUrl };
  const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env, stdio: 'inherit' });
  if (migration.error || migration.status !== 0) throw new Error('Test database migration failed');
  // Keep the real URL in DATABASE_URL only for the test's separation guard; the test switches to PT_TEST_DATABASE_URL before importing app code.
  const suites = ['tests/exerciseAnalysis.integration.test.ts'];
  if (process.argv.includes('--with-real-ai')) suites.push('tests/exerciseAnalysis.real-ai.integration.test.ts');
  if (process.argv.includes('--with-wallet')) suites.push('tests/ptWallet.integration.test.ts');
  for (const suite of suites) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', suite], {
      env: { ...env, DATABASE_URL: applicationUrl }, stdio: 'inherit',
    });
    if (result.error || result.status !== 0) throw new Error(`Integration tests failed: ${suite}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(applicationUrl, '[database URL]').replaceAll(testUrl, '[test URL]') : 'Isolated tests failed');
  process.exitCode = 1;
} finally {
  try {
    if (created) {
      // The strict generated name and created flag ensure no existing database can be dropped.
      await admin.$executeRawUnsafe(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
      await admin.$executeRawUnsafe(`DROP DATABASE [${database}]`);
      console.log(`Removed isolated local database ${database}`);
    }
  } finally { await admin.$disconnect(); }
}
