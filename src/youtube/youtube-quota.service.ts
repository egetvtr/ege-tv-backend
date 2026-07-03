import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * YouTube Data API v3 günlük quota takibi.
 *
 * Quota maliyetleri (varsayılan günlük 10.000 unit):
 *   - channels.list (contentDetails)  → 1 unit
 *   - playlistItems.list              → 1 unit / istek (50 sonuç)
 *   - videos.list (details)           → 1 unit / istek (50 ID)
 *   - search.list                     → 100 unit (KULLANILMIYOR)
 *
 * Her senkron yaklaşık 3 unit tüketir (channel + playlist + details).
 */
@Injectable()
export class YoutubeQuotaService {
  private readonly logger = new Logger(YoutubeQuotaService.name);

  /** Bir senkron işleminin kaç unit tükettiği (channel + playlist + details) */
  private readonly UNITS_PER_SYNC = 3;

  /** Günlük toplam quota (Google varsayılanı 10.000) */
  private readonly dailyLimit: number;

  /** Quota yüzde kaçına gelince uyarı logla */
  private readonly warnThresholdPct: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.dailyLimit = this.config.get<number>('YOUTUBE_QUOTA_DAILY_LIMIT', 10_000);
    this.warnThresholdPct = this.config.get<number>('YOUTUBE_QUOTA_WARN_PCT', 80);
  }

  /**
   * Bugün kullanılan tahmini quota birimlerini döner.
   * SyncLog tablosundaki `youtube` tipli başarılı logları sayarak hesaplar.
   */
  async getUsedToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await this.prisma.syncLog.count({
      where: {
        type: 'youtube',
        status: 'success',
        createdAt: { gte: startOfDay },
      },
    });

    return count * this.UNITS_PER_SYNC;
  }

  /** Tam quota durumu raporu döner */
  async getStatus(): Promise<{
    usedToday: number;
    dailyLimit: number;
    remaining: number;
    usedPercent: number;
    safeToSync: boolean;
    syncsRemainingToday: number;
  }> {
    const usedToday = await this.getUsedToday();
    const remaining = Math.max(0, this.dailyLimit - usedToday);
    const usedPercent = Math.round((usedToday / this.dailyLimit) * 100);
    const safeToSync = remaining >= this.UNITS_PER_SYNC;
    const syncsRemainingToday = Math.floor(remaining / this.UNITS_PER_SYNC);

    if (usedPercent >= this.warnThresholdPct) {
      this.logger.warn(
        `YouTube API quota %${usedPercent} kullanıldı! (${usedToday}/${this.dailyLimit} unit)`,
      );
    }

    return {
      usedToday,
      dailyLimit: this.dailyLimit,
      remaining,
      usedPercent,
      safeToSync,
      syncsRemainingToday,
    };
  }

  /**
   * Senkron öncesi çağrılır; quota yetmiyorsa false döner.
   * Processor'lar bunu kullanarak gereksiz API çağrısını önleyebilir.
   */
  async canSync(): Promise<boolean> {
    const status = await this.getStatus();
    if (!status.safeToSync) {
      this.logger.warn(
        `YouTube senkron atlandı — günlük quota tükendi (${status.usedToday}/${status.dailyLimit})`,
      );
    }
    return status.safeToSync;
  }
}
