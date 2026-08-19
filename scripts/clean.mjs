import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

for (const path of [
  'apps/api/dist',
  'apps/order-activity-consumer/dist',
  'apps/outbox-worker/dist',
  'packages/ordering/dist',
  'packages/platform/dist',
]) {
  rmSync(resolve(process.cwd(), path), { recursive: true, force: true });
}
