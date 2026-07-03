import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NewsService } from './news.service';

@Processor('news-sync')
export class NewsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(NewsSyncProcessor.name);

  constructor(private readonly newsService: NewsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`News RSS sync job başladı (job #${job.id})`);
    const result = await this.newsService.syncFromFeeds();
    this.logger.log(`News sync tamam: ${result.created} yeni haber (${result.processed} tarandı)`);
  }
}
