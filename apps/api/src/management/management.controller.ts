import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Roles, Staff, StaffAuthGuard } from '../auth/staff.guard';
import type { StaffContext } from '../auth/auth.types';
import { MenuAdminService } from './menu.admin.service';
import { TablesAdminService } from './tables.admin.service';
import { RestaurantAdminService } from './restaurant.admin.service';
import { StaffAdminService } from './staff.admin.service';
import { ReviewsAdminService } from './reviews.admin.service';
import {
  AvailabilityDto,
  CategoryDto,
  MenuItemDto,
  RestaurantSettingsDto,
  StaffCreateDto,
  StaffPasswordDto,
  StaffUpdateDto,
  TableDto,
} from './dto';

class ArchivedDto {
  @IsBoolean()
  isArchived!: boolean;
}

class ActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

/**
 * Konfiguracja lokalu. Domyślnie zastrzeżona dla właściciela i managera —
 * kelner i kuchnia nie zmieniają cen ani ustawień zamawiania.
 */
@Controller('management')
@UseGuards(StaffAuthGuard)
@Roles('owner', 'manager')
export class ManagementController {
  constructor(
    private readonly menu: MenuAdminService,
    private readonly tables: TablesAdminService,
    private readonly restaurant: RestaurantAdminService,
    private readonly staffAdmin: StaffAdminService,
    private readonly reviews: ReviewsAdminService,
  ) {}

  /** Opinie gości. Nieprzeczytane na górze — inaczej mechanizm jest pozorny. */
  @Get('reviews')
  listReviews(@Staff() staff: StaffContext) {
    return this.reviews.list(staff);
  }

  @Post('reviews/:id/read')
  markReviewRead(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.markRead(staff, id);
  }

  @Get('menu')
  fullMenu(@Staff() staff: StaffContext) {
    return this.menu.fullMenu(staff);
  }

  @Post('menu/categories')
  createCategory(@Staff() staff: StaffContext, @Body() dto: CategoryDto) {
    return this.menu.createCategory(staff, dto);
  }

  @Patch('menu/categories/:id')
  updateCategory(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoryDto,
  ) {
    return this.menu.updateCategory(staff, id, dto);
  }

  @Patch('menu/categories/:id/archived')
  archiveCategory(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchivedDto,
  ) {
    return this.menu.archiveCategory(staff, id, dto.isArchived);
  }

  @Post('menu/items')
  createItem(@Staff() staff: StaffContext, @Body() dto: MenuItemDto) {
    return this.menu.createItem(staff, dto);
  }

  @Patch('menu/items/:id')
  updateItem(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MenuItemDto,
  ) {
    return this.menu.updateItem(staff, id, dto);
  }

  /**
   * Wyłączenie dostępności to codzienna czynność w trakcie serwisu
   * („skończył się dorsz"), więc wolno ją wykonać także kelnerowi i kuchni.
   */
  @Patch('menu/items/:id/availability')
  @Roles('owner', 'manager', 'waiter', 'kitchen')
  setAvailability(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AvailabilityDto,
  ) {
    return this.menu.setAvailability(staff, id, dto.isAvailable);
  }

  @Patch('menu/items/:id/archived')
  archiveItem(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchivedDto,
  ) {
    return this.menu.archiveItem(staff, id, dto.isArchived);
  }

  @Get('tables')
  listTables(@Staff() staff: StaffContext) {
    return this.tables.list(staff);
  }

  @Post('tables')
  createTable(@Staff() staff: StaffContext, @Body() dto: TableDto) {
    return this.tables.create(staff, dto);
  }

  @Patch('tables/:id')
  updateTable(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TableDto,
  ) {
    return this.tables.update(staff, id, dto);
  }

  @Post('tables/:id/regenerate-qr')
  regenerateQr(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tables.regenerateQr(staff, id);
  }

  @Patch('tables/:id/active')
  setTableActive(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActiveDto,
  ) {
    return this.tables.setActive(staff, id, dto.isActive);
  }

  @Get('restaurant')
  getRestaurant(@Staff() staff: StaffContext) {
    return this.restaurant.get(staff);
  }

  @Patch('restaurant')
  updateRestaurant(@Staff() staff: StaffContext, @Body() dto: RestaurantSettingsDto) {
    return this.restaurant.update(staff, dto);
  }

  @Get('staff')
  listStaff(@Staff() staff: StaffContext) {
    return this.staffAdmin.list(staff);
  }

  @Post('staff')
  createStaff(@Staff() staff: StaffContext, @Body() dto: StaffCreateDto) {
    return this.staffAdmin.create(staff, dto);
  }

  @Patch('staff/:id')
  updateStaff(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffUpdateDto,
  ) {
    return this.staffAdmin.update(staff, id, dto);
  }

  @Patch('staff/:id/active')
  setStaffActive(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActiveDto,
  ) {
    return this.staffAdmin.setActive(staff, id, dto.isActive);
  }

  @Post('staff/:id/reset-password')
  resetStaffPassword(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffPasswordDto,
  ) {
    return this.staffAdmin.resetPassword(staff, id, dto.password);
  }
}
