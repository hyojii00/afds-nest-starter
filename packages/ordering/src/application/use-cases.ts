import { Order, type OrderSnapshot } from '../domain/order';
import type { OrderRepository, OrderUnitOfWork } from './ports';
import { OrderNotFoundError } from './ports';

export interface CreateOrderCommand {
  readonly customerId: string;
  readonly currency: string;
  readonly items: ReadonlyArray<{
    readonly sku: string;
    readonly quantity: number;
    readonly unitPriceMinor: number;
  }>;
}

export class CreateOrder {
  constructor(private readonly unitOfWork: OrderUnitOfWork) {}

  async execute(command: CreateOrderCommand): Promise<OrderSnapshot> {
    const order = Order.create(command);
    await this.unitOfWork.save(order);
    return order.snapshot;
  }
}

export class GetOrder {
  constructor(private readonly repository: OrderRepository) {}

  async execute(id: string): Promise<OrderSnapshot> {
    return (await findOrder(this.repository, id)).snapshot;
  }
}

export class ConfirmOrder {
  constructor(
    private readonly repository: OrderRepository,
    private readonly unitOfWork: OrderUnitOfWork,
  ) {}

  async execute(id: string): Promise<OrderSnapshot> {
    const order = await findOrder(this.repository, id);
    order.confirm();
    await this.unitOfWork.save(order);
    return order.snapshot;
  }
}

export class CancelOrder {
  constructor(
    private readonly repository: OrderRepository,
    private readonly unitOfWork: OrderUnitOfWork,
  ) {}

  async execute(id: string, reason: string): Promise<OrderSnapshot> {
    const order = await findOrder(this.repository, id);
    order.cancel(reason);
    await this.unitOfWork.save(order);
    return order.snapshot;
  }
}

async function findOrder(repository: OrderRepository, id: string): Promise<Order> {
  const order = await repository.findById(id);
  if (!order) {
    throw new OrderNotFoundError(`order ${id} was not found`);
  }
  return order;
}
