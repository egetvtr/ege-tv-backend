import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { YoutubeService } from './youtube.service';
import { YoutubeQuotaService } from './youtube-quota.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('youtube-sync')
export class YoutubeSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(YoutubeSyncProcessor.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly quotaService: YoutubeQuotaService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`YouTube sync job başladı (job #${job.id})`);

    // Quota kontrolü — yeterli quota yoksa sync'i atla
    const canSync = await this.quotaService.canSync();
    if (!canSync) {
      this.logger.warn('YouTube sync atlandı: günlük quota limiti aşıldı');
      return;
    }

    try {
      await this.youtubeService.syncVideos();
    } catch (error) {
      this.logger.error(`YouTube sync hata: ${error.message}`);
      await this.prisma.syncLog.create({
        data: {
          type: 'youtube',
          status: 'failed',
          message: error.message,
        },
      });
      throw error;
    }
  }
}
