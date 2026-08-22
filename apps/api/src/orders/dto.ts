import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  /** Identyfikatory wybranych modyfikatorów; walidowane wobec grup dania. */
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  modifierIds?: string[];

  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsString()
  @MaxLength(500)
  @IsOptional()
  guestNote?: string;
}
