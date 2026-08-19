import { Module } from '@nestjs/common';
import { DatabaseModule, DatabaseService } from '@afds-nest-starter/platform';
import { ORDER_REPOSITORY, ORDER_UNIT_OF_WORK } from './application/ports';
import { CancelOrder, ConfirmOrder, CreateOrder, GetOrder } from './application/use-cases';
import { DrizzleOrderRepository } from './infrastructure/persistence/drizzle-order.repository';
import { OrdersController } from './presentation/orders.controller';
import { CANCEL_ORDER, CONFIRM_ORDER, CREATE_ORDER, GET_ORDER } from './presentation/tokens';

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
      provide: CREATE_ORDER,
      useFactory: (unitOfWork: DrizzleOrderRepository) => new CreateOrder(unitOfWork),
      inject: [ORDER_UNIT_OF_WORK],
    },
    {
      provide: GET_ORDER,
      useFactory: (repository: DrizzleOrderRepository) => new GetOrder(repository),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: CONFIRM_ORDER,
      useFactory: (repository: DrizzleOrderRepository, unitOfWork: DrizzleOrderRepository) =>
        new ConfirmOrder(repository, unitOfWork),
      inject: [ORDER_REPOSITORY, ORDER_UNIT_OF_WORK],
    },
    {
      provide: CANCEL_ORDER,
      useFactory: (repository: DrizzleOrderRepository, unitOfWork: DrizzleOrderRepository) =>
        new CancelOrder(repository, unitOfWork),
      inject: [ORDER_REPOSITORY, ORDER_UNIT_OF_WORK],
    },
  ],
})
export class OrderingModule {}
