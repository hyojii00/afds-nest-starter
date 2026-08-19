import type { Order } from '../domain/order';

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
}

export interface OrderUnitOfWork {
  save(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
export const ORDER_UNIT_OF_WORK = Symbol('ORDER_UNIT_OF_WORK');

export class OrderNotFoundError extends Error {
  override readonly name = 'OrderNotFoundError';
}

export class OptimisticLockError extends Error {
  override readonly name = 'OptimisticLockError';
}
