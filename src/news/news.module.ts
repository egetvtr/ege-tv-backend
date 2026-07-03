import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { NewsService } from './news.service';
import { NewsAiService } from './news-ai.service';
import { NewsController } from './news.controller';
import { NewsSyncProcessor } from './news-sync.processor';
import { FeedSourceService } from './feed-source.service';
import { FeedSourceController } from './feed-source.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'news-sync',
    }),
  ],
  controllers: [NewsController, FeedSourceController],
  providers: [NewsService, NewsAiService, NewsSyncProcessor, FeedSourceService],
  exports: [NewsService],
})
export class NewsModule implements OnModuleInit {
  constructor(
    @InjectQueue('news-sync') private readonly syncQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const cronPattern = this.config.get<string>('NEWS_SYNC_CRON', '*/30 * * * *');

    await this.syncQueue.upsertJobScheduler(
      'news-periodic-sync',
      { pattern: cronPattern },
      { name: 'sync-now', data: {} },
    );
  }
}
