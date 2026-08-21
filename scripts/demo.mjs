import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const root = process.cwd();
const port = Number(process.env.PORT ?? 3000);
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://afds:afds@localhost:5432/afds_nest_starter';
const applications = [];
let activeCommand;
let interrupted = false;
let pool;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interrupted = true;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    activeCommand?.kill(signal);
    for (const application of applications) {
      application.child.kill(signal);
    }
  });
}

try {
  await assertPortAvailable(port);
  await step('Local dependencies', 'docker', [
    'compose',
    'up',
    '-d',
    '--wait',
    'postgres',
    'kafka',
  ]);
  await step('Database migrations', 'pnpm', ['db:migrate']);
  await step('SWC production build', 'pnpm', ['build']);

  const runtimeEnvironment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? 'localhost:9092',
    KAFKA_TOPIC: process.env.KAFKA_TOPIC ?? 'ordering.events',
    KAFKA_CONSUMER_GROUP_ID: 'order-activity.demo',
    OUTBOX_POLL_INTERVAL_MS: '200',
    PORT: String(port),
  };
  const consumer = startApplication(
    'consumer',
    'apps/order-activity-consumer/dist/src/main.js',
    runtimeEnvironment,
  );
  const worker = startApplication(
    'worker',
    'apps/outbox-worker/dist/src/main.js',
    runtimeEnvironment,
  );
  startApplication('api', 'apps/api/dist/src/main.js', runtimeEnvironment);

  await waitFor(
    () => consumer.output.includes('Order activity consumer is running'),
    'consumer startup',
  );
  await waitFor(() => worker.output.includes('Outbox worker is running'), 'worker startup');
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/health/ready`)).ok;
    } catch {
      return false;
    }
  }, 'API readiness');

  const response = await fetch(`http://127.0.0.1:${port}/api/v1/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerId: 'portfolio-demo',
      currency: 'KRW',
      items: [{ sku: 'AFDS-DEMO', quantity: 2, unitPriceMinor: 2_500 }],
    }),
  });
  const order = await response.json();
  if (response.status !== 201 || typeof order.id !== 'string') {
    throw new Error(`order creation returned ${response.status}: ${JSON.stringify(order)}`);
  }
  console.log(`✓ API          201 order=${order.id}`);

  pool = new Pool({ connectionString: databaseUrl });
  const evidence = await waitForEvidence(order.id);
  console.log(
    `✓ Outbox       event=${evidence.event_id} status=${evidence.status} attempts=${evidence.attempts}`,
  );
  console.log(`✓ Kafka        event=${evidence.event_id} delivered to order-activity consumer`);
  console.log(
    `✓ Projection   event=${evidence.projection_event_id} order=${evidence.order_id} total=${evidence.total_amount_minor}`,
  );
} catch (error) {
  if (!interrupted) {
    console.error(`Demo failed: ${error instanceof Error ? error.message : String(error)}`);
    printApplicationLogs();
    process.exitCode = 1;
  }
} finally {
  await pool?.end();
  await stopApplications();
}

async function step(label, command, args) {
  process.stdout.write(`… ${label}\n`);
  await run(command, args);
  console.log(`✓ ${label}`);
}

async function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeCommand = child;
  let output = '';
  let spawnError;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  await once(child, 'close');
  activeCommand = undefined;
  if (spawnError) {
    throw new Error(`${command} could not start: ${spawnError.message}`);
  }
  if (child.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${child.exitCode}\n${output.trim()}`);
  }
}

function startApplication(name, relativeEntry, environment) {
  const child = spawn(process.execPath, [resolve(root, relativeEntry)], {
    cwd: root,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const application = { name, child, output: '' };
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      application.output = `${application.output}${chunk}`.slice(-8_000);
    });
  }
  applications.push(application);
  return application;
}

async function waitFor(predicate, description, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (interrupted) {
      throw new Error('demo interrupted');
    }
    const exited = applications.find(({ child }) => child.exitCode !== null);
    if (exited) {
      throw new Error(`${exited.name} exited before ${description}`);
    }
    if (await predicate()) {
      return;
    }
    await delay(200);
  }
  throw new Error(`${description} was not ready within ${timeoutMs / 1_000} seconds`);
}

async function waitForEvidence(orderId) {
  let evidence;
  await waitFor(async () => {
    const result = await pool.query(
      `select
         oe.id as event_id,
         oe.status,
         oe.attempts,
         oa.event_id as projection_event_id,
         oa.order_id,
         oa.total_amount_minor
       from outbox_events oe
       left join order_activity oa on oa.event_id = oe.id
       where oe.aggregate_id = $1
         and oe.event_type = 'ordering.order.created.v1'
       limit 1`,
      [orderId],
    );
    evidence = result.rows[0];
    return evidence?.status === 'PUBLISHED' && evidence.projection_event_id === evidence.event_id;
  }, 'Outbox delivery and projection');
  return evidence;
}

async function assertPortAvailable(targetPort) {
  if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${targetPort}`);
  }
  const server = createServer();
  server.unref();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(targetPort, '127.0.0.1', resolvePromise);
  }).catch((error) => {
    throw new Error(
      error?.code === 'EADDRINUSE'
        ? `port ${targetPort} is already in use; stop the existing API before running the demo`
        : `port ${targetPort} is unavailable`,
    );
  });
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

async function stopApplications() {
  for (const { child } of applications) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }
  await Promise.all(
    applications.map(async ({ child }) => {
      if (child.exitCode !== null) {
        return;
      }
      await Promise.race([once(child, 'exit'), delay(5_000)]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }),
  );
}

function printApplicationLogs() {
  for (const application of applications) {
    if (application.output.trim()) {
      console.error(`\n[${application.name}]\n${application.output.trim()}`);
    }
  }
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
