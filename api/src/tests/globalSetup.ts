import { execFileSync } from 'node:child_process';
import { assertIsTestDatabase, testDatabaseUrl } from './testDatabase.js';

/**
 * Runs once before the whole test run: applies the migrations to the test database.
 * It is safe to repeat, because already-applied migrations are skipped.
 */
export default function setup(): void {
  const url = testDatabaseUrl();
  assertIsTestDatabase(url);

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const output = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(
      'Could not prepare the test database. Is PostgreSQL running, and does the database ' +
        '"salary_management_test" exist? See the README, "Local setup".\n' +
        output.split('\n').slice(0, 6).join('\n'),
      { cause: error },
    );
  }
}
