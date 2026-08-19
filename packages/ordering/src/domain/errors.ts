export class DomainValidationError extends Error {
  override readonly name = 'DomainValidationError';
}

export class InvalidOrderStateError extends Error {
  override readonly name = 'InvalidOrderStateError';
}
