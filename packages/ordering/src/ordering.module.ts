import { Module } from '@nestjs/common';
import { DatabaseModule, DatabaseService } from '@afds-nest-starter/platform';
import {
  ORDER_REPOSITORY,
  ORDER_UNIT_OF_WORK,
  type OrderRepository,
  type OrderUnitOfWork,
} from './application/ports';
import { CancelOrder, ConfirmOrder, CreateOrder, GetOrder } from './application/use-cases';
import { DrizzleOrderRepository } from './infrastructure/persistence/drizzle-order.repository';
import { OrdersController } from './presentation/orders.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [
    {
      provide: DrizzleOrderRepository,
      useFactory: (database: DatabaseService) => new DrizzleOrderRepository(database),
      inject: [DatabaseService],
    },
    { provide: ORDER_REPOSITORY, useExisting: DrizzleOrderRepository },
    { provide: ORDER_UNIT_OF_WORK, useExisting: DrizzleOrderRepository },
    {
      provide: CreateOrder,
      useFactory: (unitOfWork: OrderUnitOfWork) => new CreateOrder(unitOfWork),
      inject: [ORDER_UNIT_OF_WORK],
    },
    {
      provide: GetOrder,
      useFactory: (repository: OrderRepository) => new GetOrder(repository),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ConfirmOrder,
      useFactory: (repository: OrderRepository, unitOfWork: OrderUnitOfWork) =>
        new ConfirmOrder(repository, unitOfWork),
      inject: [ORDER_REPOSITORY, ORDER_UNIT_OF_WORK],
    },
    {
      provide: CancelOrder,
      useFactory: (repository: OrderRepository, unitOfWork: OrderUnitOfWork) =>
        new CancelOrder(repository, unitOfWork),
      inject: [ORDER_REPOSITORY, ORDER_UNIT_OF_WORK],
    },
  ],
})
export class OrderingModule {}
