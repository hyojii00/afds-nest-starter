import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CancelOrder, ConfirmOrder, CreateOrder, GetOrder } from '../application/use-cases';
import { OptimisticLockError, OrderNotFoundError } from '../application/ports';
import { DomainValidationError, InvalidOrderStateError } from '../domain/errors';
import type { OrderSnapshot } from '../domain/order';
import { CancelOrderDto, CreateOrderDto } from './dtos';
import { CANCEL_ORDER, CONFIRM_ORDER, CREATE_ORDER, GET_ORDER } from './tokens';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(CREATE_ORDER) private readonly createOrder: CreateOrder,
    @Inject(GET_ORDER) private readonly getOrder: GetOrder,
    @Inject(CONFIRM_ORDER) private readonly confirmOrder: ConfirmOrder,
    @Inject(CANCEL_ORDER) private readonly cancelOrder: CancelOrder,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a pending order' })
  @ApiCreatedResponse({ description: 'The order was created' })
  async create(@Body() body: CreateOrderDto): Promise<OrderSnapshot> {
    return this.mapErrors(() => this.createOrder.execute(body));
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get an order' })
  @ApiOkResponse({ description: 'The current order snapshot' })
  async get(@Param('orderId', new ParseUUIDPipe()) id: string): Promise<OrderSnapshot> {
    return this.mapErrors(() => this.getOrder.execute(id));
  }

  @Post(':orderId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a pending order' })
  async confirm(@Param('orderId', new ParseUUIDPipe()) id: string): Promise<OrderSnapshot> {
    return this.mapErrors(() => this.confirmOrder.execute(id));
  }

  @Post(':orderId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending order' })
  async cancel(
    @Param('orderId', new ParseUUIDPipe()) id: string,
    @Body() body: CancelOrderDto,
  ): Promise<OrderSnapshot> {
    return this.mapErrors(() => this.cancelOrder.execute(id, body.reason));
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidOrderStateError || error instanceof OptimisticLockError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof DomainValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
