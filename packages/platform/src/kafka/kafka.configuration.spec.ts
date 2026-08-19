import { describe, expect, it } from 'vitest';
import { readKafkaConsumerGroupId, readKafkaSettings } from './kafka.configuration';

describe('Kafka configuration', () => {
  it('normalizes broker and topic settings', () => {
    expect(
      readKafkaSettings({
        KAFKA_BROKERS: ' kafka-1:9092, kafka-2:9092 ',
        KAFKA_TOPIC: ' ordering.events ',
      }),
    ).toEqual({ brokers: ['kafka-1:9092', 'kafka-2:9092'], topic: 'ordering.events' });
  });

  it.each(['KAFKA_BROKERS', 'KAFKA_TOPIC'])('requires %s', (name) => {
    const environment = {
      KAFKA_BROKERS: 'localhost:9092',
      KAFKA_TOPIC: 'ordering.events',
      [name]: '',
    };

    expect(() => readKafkaSettings(environment)).toThrow(`${name} is required`);
  });

  it('requires a consumer group ID', () => {
    expect(() => readKafkaConsumerGroupId({})).toThrow('KAFKA_CONSUMER_GROUP_ID is required');
  });
});
