import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles, Staff, StaffAuthGuard } from '../auth/staff.guard';
import type { StaffContext } from '../auth/auth.types';
import { MenuImageService } from './menu-image.service';
import { MAX_BAJTOW, mimeDlaPliku } from './menu-image.storage';

/**
 * Wydawanie zdjęć. **Bez strażnika** — te same pliki widzi każdy gość, który
 * zeskanuje kod QR, a karta menu nie jest tajemnicą.
 *
 * Serwuje je API, nie Caddy, żeby lokalnie i na produkcji działało dokładnie tak
 * samo. Gdyby ruch kiedyś to uzasadnił, postawienie przed tym serwera plików jest
 * zmianą konfiguracji, nie kodu.
 */
@Controller('media/menu')
export class MenuImagePublicController {
  constructor(private readonly images: MenuImageService) {}

  @Get(':nazwa')
  async serve(@Param('nazwa') nazwa: string, @Res() response: Response) {
    const bajty = await this.images.read(nazwa);

    response.setHeader('content-type', mimeDlaPliku(nazwa));
    // Nazwa pliku jest losowa i nigdy się nie zmienia w miejscu: wgranie nowego
    // zdjęcia tworzy nowy plik. Dzięki temu wolno cachować bez oglądania się.
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.send(bajty);
  }
}

@Controller('management/menu/items/:id/image')
@UseGuards(StaffAuthGuard)
@Roles('owner', 'manager')
export class MenuImageAdminController {
  constructor(private readonly images: MenuImageService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BAJTOW } }))
  upload(
    @Staff() staff: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Nie dostaliśmy pliku ze zdjęciem.');
    }
    return this.images.upload(staff, id, file.buffer);
  }

  @Delete()
  remove(@Staff() staff: StaffContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.images.remove(staff, id);
  }
}
