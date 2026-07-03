import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { YoutubeSyncProcessor } from './youtube-sync.processor';
import { YoutubeQuotaService } from './youtube-quota.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'youtube-sync',
    }),
  ],
  controllers: [YoutubeController],
  providers: [YoutubeService, YoutubeSyncProcessor, YoutubeQuotaService],
  exports: [YoutubeService, YoutubeQuotaService],
})
export class YoutubeModule implements OnModuleInit {
  constructor(
    @InjectQueue('youtube-sync') private readonly syncQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  // Uygulama açılışında tekrarlayan (repeatable) job'u kurar.
  // Cron pattern .env'den okunur (örn: "*/15 * * * *" -> her 15 dakikada bir)
  async onModuleInit() {
    const cronPattern = this.config.get<string>('YOUTUBE_SYNC_CRON', '*/15 * * * *');

    await this.syncQueue.upsertJobScheduler(
      'youtube-periodic-sync',
      { pattern: cronPattern },
      { name: 'sync-now', data: {} },
    );
  }
}
