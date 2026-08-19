import { KafkaContainer, type StartedKafkaContainer } from '@testcontainers/kafka';

const KAFKA_PORT = 9093;

export function startKafka(): Promise<StartedKafkaContainer> {
  return new KafkaContainer('confluentinc/cp-kafka:8.1.1').start();
}

export function getKafkaBroker(container: StartedKafkaContainer): string {
  return `${container.getHost()}:${container.getMappedPort(KAFKA_PORT)}`;
}
