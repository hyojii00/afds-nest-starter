import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service';

@Injectable()
export class OutboxRunnerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRunnerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly relay: OutboxRelayService) {}

  onApplicationBootstrap(): void {
    const intervalMs = readPositiveInteger('OUTBOX_POLL_INTERVAL_MS', 1_000);
    this.timer = setInterval(() => void this.tick(), intervalMs);
    void this.tick();
    this.logger.log(`Outbox relay started with a ${intervalMs}ms polling interval`);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.relay.runOnce({
        batchSize: readPositiveInteger('OUTBOX_BATCH_SIZE', 50),
        maxAttempts: readPositiveInteger('OUTBOX_MAX_ATTEMPTS', 10),
        lockTimeoutMs: readPositiveInteger('OUTBOX_LOCK_TIMEOUT_MS', 300_000),
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
