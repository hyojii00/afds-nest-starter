import { DomainValidationError } from './errors';

export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: string,
  ) {}

  static of(amountMinor: number, currency: string): Money {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new DomainValidationError('amountMinor must be a non-negative safe integer');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainValidationError('currency must be a three-letter uppercase code');
    }
    return new Money(amountMinor, currency);
  }

  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new DomainValidationError('quantity must be a positive safe integer');
    }
    return Money.of(this.amountMinor * quantity, this.currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new DomainValidationError('cannot add money in different currencies');
    }
    return Money.of(this.amountMinor + other.amountMinor, this.currency);
  }
}
