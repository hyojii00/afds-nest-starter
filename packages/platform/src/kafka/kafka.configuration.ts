type Environment = Readonly<Record<string, string | undefined>>;

export interface KafkaSettings {
  readonly brokers: readonly string[];
  readonly topic: string;
}

export function readKafkaSettings(environment: Environment = process.env): KafkaSettings {
  const brokers = readRequired('KAFKA_BROKERS', environment)
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) {
    throw new Error('KAFKA_BROKERS is required');
  }

  return {
    brokers,
    topic: readRequired('KAFKA_TOPIC', environment),
  };
}

export function readKafkaConsumerGroupId(environment: Environment = process.env): string {
  return readRequired('KAFKA_CONSUMER_GROUP_ID', environment);
}

function readRequired(name: string, environment: Environment): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
