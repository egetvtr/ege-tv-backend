import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { FeedSourceService } from './feed-source.service';
import { CreateFeedSourceDto } from './dto/create-feed-source.dto';
import { UpdateFeedSourceDto } from './dto/update-feed-source.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * /api/feed-sources — RSS Kaynak Yönetimi (tüm route'lar admin)
 *
 * GET    /api/feed-sources           → listele
 * POST   /api/feed-sources           → oluştur
 * GET    /api/feed-sources/:id       → detay
 * PATCH  /api/feed-sources/:id       → güncelle
 * DELETE /api/feed-sources/:id       → sil
 * PATCH  /api/feed-sources/:id/toggle → aktif/pasif
 * POST   /api/feed-sources/:id/sync  → hemen senkronize et
 * GET    /api/feed-sources/sync-logs → senkron geçmişi
 */
@ApiTags('feed-sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed-sources')
export class FeedSourceController {
  constructor(private readonly feedSourceService: FeedSourceService) {}

  // ---- Listeleme ----

  @Get()
  @ApiOperation({ summary: '[Admin] Tüm RSS kaynaklarını listele' })
  findAll() {
    return this.feedSourceService.findAll();
  }

  @Get('sync-logs')
  @ApiOperation({ summary: '[Admin] RSS senkron loglarını getir' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getSyncLogs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.feedSourceService.getSyncLogs(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] RSS kaynağı detayı' })
  @ApiParam({ name: 'id', description: 'Feed source UUID' })
  findOne(@Param('id') id: string) {
    return this.feedSourceService.findOne(id);
  }

  // ---- Oluşturma / Güncelleme ----

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Yeni RSS kaynağı ekle' })
  create(@Body() dto: CreateFeedSourceDto) {
    return this.feedSourceService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] RSS kaynağını güncelle' })
  @ApiParam({ name: 'id', description: 'Feed source UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateFeedSourceDto) {
    return this.feedSourceService.update(id, dto);
  }

  // ---- Aktif / Pasif ----

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] RSS kaynağını aktif/pasif yap' })
  @ApiParam({ name: 'id', description: 'Feed source UUID' })
  toggleActive(@Param('id') id: string) {
    return this.feedSourceService.toggleActive(id);
  }

  // ---- Sil ----

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin][SUPER_ADMIN] RSS kaynağını sil' })
  @ApiParam({ name: 'id', description: 'Feed source UUID' })
  remove(@Param('id') id: string) {
    return this.feedSourceService.remove(id);
  }

  // ---- Manuel Senkronizasyon ----

  @Post(':id/sync')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] RSS kaynağını hemen senkronize et' })
  @ApiParam({ name: 'id', description: 'Feed source UUID' })
  syncOne(@Param('id') id: string) {
    return this.feedSourceService.syncOne(id);
  }
}
