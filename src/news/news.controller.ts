import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    @InjectQueue('news-sync') private readonly syncQueue: Queue,
  ) {}

  // ---- PUBLIC ----

  @Get()
  @ApiOperation({ summary: 'Yayınlanan haberleri listele (public site)' })
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('category') category?: string,
  ) {
    return this.newsService.listPublished(page, limit, category);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Slug ile haber detayı' })
  findOne(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  // ---- ADMIN (JWT token gerekli) ----

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Tüm haberleri listele (DRAFT, PENDING dahil)' })
  adminList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.newsService.listAll(page, limit, status, category);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Manuel haber oluştur' })
  create(@Body() dto: CreateNewsDto, @Request() req: any) {
    return this.newsService.createManual(dto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Haberi güncelle / yayına al / reddet' })
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Haberi yayına al' })
  publish(@Param('id') id: string) {
    return this.newsService.publish(id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Haberi reddet' })
  reject(@Param('id') id: string) {
    return this.newsService.reject(id);
  }

  @Post('sync/rss')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] RSS kaynaklarından haber senkronunu manuel tetikle' })
  async triggerSync() {
    const job = await this.syncQueue.add('sync-now', {});
    return { message: 'Haber senkronu kuyruğa eklendi', jobId: job.id };
  }
}
