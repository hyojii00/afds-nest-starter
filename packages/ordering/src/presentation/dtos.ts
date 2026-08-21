import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_ORDER_ITEM_QUANTITY } from '../domain/order';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'BOOK-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_ORDER_ITEM_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_ITEM_QUANTITY)
  quantity!: number;

  @ApiProperty({ example: 2500, minimum: 0, description: 'Price in the currency minor unit' })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'customer-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerId!: string;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Customer requested cancellation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
