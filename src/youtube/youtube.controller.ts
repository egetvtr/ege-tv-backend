import { Controller, Get, Post, Patch, Param, Body, Query, DefaultValuePipe, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { AdminRole, VideoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeQuotaService } from './youtube-quota.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class UpdateVideoDto {
  @ApiProperty({ enum: VideoStatus, required: false })
  status?: VideoStatus;

  @ApiProperty({ required: false })
  categoryId?: string;
}

@ApiTags('youtube')
@Controller('videos')
export class YoutubeController {
  constructor(
    @InjectQueue('youtube-sync') private readonly syncQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly quotaService: YoutubeQuotaService,
  ) {}

  // ---- PUBLIC ----

  @Get()
  @ApiOperation({ summary: 'Yayındaki videoları listele (public site için)' })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('category') category?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'ACTIVE' };
    if (category) where.category = { slug: category };

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: { category: true },
      }),
      this.prisma.video.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // ---- ADMIN (JWT token gerekli) ----

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Tüm videoları listele (HIDDEN dahil)' })
  async adminList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: { category: true },
      }),
      this.prisma.video.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] YouTube senkronunu manuel tetikle' })
  async triggerSync() {
    // Sync öncesi quota kontrolü
    const quota = await this.quotaService.getStatus();
    if (!quota.safeToSync) {
      return {
        message: 'Günlük YouTube API quota tükendi, senkron çalıştırılamaz',
        quota,
      };
    }
    const job = await this.syncQueue.add('sync-now', {});
    return { message: 'Senkron kuyruğa eklendi', jobId: job.id, quota };
  }

  @Get('admin/quota')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] YouTube API günlük quota durumu' })
  async getQuota() {
    return this.quotaService.getStatus();
  }

  @Get('admin/sync-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] YouTube senkron logları' })
  async getSyncLogs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.prisma.syncLog.findMany({
      where: { type: 'youtube' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Videoyu güncelle (kategori/durum)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;

    return this.prisma.video.update({
      where: { id },
      data,
    });
  }
}
