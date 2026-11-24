const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * The seed script deletes all employees first, so it must not run on a real database by mistake.
 * A database on this computer is always fine. Any other needs SEED_CONFIRM=yes.
 */
export function assertSafeToSeed(databaseUrl: string, confirm: string | undefined): void {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    // The message does not include the URL, because it contains the password.
    throw new Error('DATABASE_URL is not a valid connection string.');
  }

  if (LOCAL_HOSTS.includes(host) || confirm === 'yes') return;

  throw new Error(
    `The seed script deletes all employees, and "${host}" is not on this computer. ` +
      'Run it again with SEED_CONFIRM=yes if you really want to replace the data there.',
  );
}
