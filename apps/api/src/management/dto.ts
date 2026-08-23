import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { STAFF_ROLES, type StaffRole } from '@kelbroo/types';

/** Nazwa i opis w jednym języku. Restauracja podaje komplet dla obsługiwanych. */
export class TranslationDto {
  @IsString()
  @Length(2, 8)
  locale!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}

export class CategoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ModifierDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];

  @IsInt()
  @Min(-100000)
  @Max(100000)
  priceDeltaCents!: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

export class ModifierGroupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];

  @IsInt()
  @Min(0)
  @Max(20)
  minSelect!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect!: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ModifierDto)
  modifiers!: ModifierDto[];
}

export class MenuItemDto {
  @IsString()
  categoryId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];

  /** Cena brutto w groszach — nigdy liczba zmiennoprzecinkowa. */
  @IsInt()
  @Min(0)
  @Max(10_000_00)
  priceCents!: number;

  /** Stawka VAT jako liczba całkowita punktów procentowych (8 = 8%). */
  @IsInt()
  @Min(0)
  @Max(100)
  vatPercent!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  allergens?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  dietaryTags?: string[];

  @IsInt()
  @Min(0)
  @Max(300)
  @IsOptional()
  prepTimeMinutes?: number;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupDto)
  @IsOptional()
  modifierGroups?: ModifierGroupDto[];
}

export class AvailabilityDto {
  @IsBoolean()
  isAvailable!: boolean;
}

export class TableDto {
  @IsString()
  @Length(1, 40)
  label!: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  zone?: string;

  @IsInt()
  @Min(1)
  @Max(40)
  @IsOptional()
  seats?: number;
}

export class RestaurantSettingsDto {
  @IsString()
  @Length(1, 120)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  address?: string;

  @IsIn(['prepaid', 'pay_at_table', 'guest_choice'])
  @IsOptional()
  orderingMode?: 'prepaid' | 'pay_at_table' | 'guest_choice';

  @IsBoolean()
  @IsOptional()
  requireStaffConfirmation?: boolean;

  @IsBoolean()
  @IsOptional()
  tableActivationRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  hostApprovesGuests?: boolean;

  @IsBoolean()
  @IsOptional()
  partialSettlementEnabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minOrderCents?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  openBillLimitCents?: number;

  @IsString()
  @Length(2, 8)
  @IsOptional()
  defaultLocale?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsOptional()
  supportedLocales?: string[];

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  businessDayStartHour?: number;
}

/**
 * Hasło startowe pracownika. Górny limit to 72 bajty — tyle bierze pod uwagę
 * bcrypt, resztę ucina po cichu.
 */
export class StaffCreateDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsIn(STAFF_ROLES)
  role!: StaffRole;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class StaffUpdateDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(1, 120)
  @IsOptional()
  name?: string;

  @IsIn(STAFF_ROLES)
  @IsOptional()
  role?: StaffRole;
}

export class StaffPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
