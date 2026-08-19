export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }
  try {
    new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  for (const name of [
    'PORT',
    'OUTBOX_POLL_INTERVAL_MS',
    'OUTBOX_BATCH_SIZE',
    'OUTBOX_MAX_ATTEMPTS',
    'OUTBOX_LOCK_TIMEOUT_MS',
  ]) {
    const value = config[name];
    if (value === undefined) {
      continue;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
  }

  return config;
}
