import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, youtube_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

export interface YoutubeSyncResult {
  fetched: number;
  created: number;
  updated: number;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly youtube: youtube_v3.Youtube;
  private readonly channelId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.config.get<string>('YOUTUBE_API_KEY', ''),
    });
    this.channelId = this.config.get<string>('YOUTUBE_CHANNEL_ID', '');
  }

  /**
   * Kanaldaki "uploads" playlist'inden en güncel videoları çeker.
   * Playlist yöntemi search.list'e göre çok daha az quota tüketir.
   */
  async fetchLatestVideos(maxResults = 25): Promise<youtube_v3.Schema$PlaylistItem[]> {
    // 1) Kanalın "uploads" playlist ID'sini bul
    const channelRes = await this.youtube.channels.list({
      part: ['contentDetails'],
      id: [this.channelId],
    });

    const uploadsPlaylistId =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error('Uploads playlist bulunamadı - YOUTUBE_CHANNEL_ID kontrol et');
    }

    // 2) Playlist'ten son videoları çek
    const playlistRes = await this.youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    return playlistRes.data.items ?? [];
  }

  /** Video ID listesi için detay bilgisi (süre, izlenme) çeker */
  async fetchVideoDetails(videoIds: string[]): Promise<youtube_v3.Schema$Video[]> {
    if (videoIds.length === 0) return [];
    const res = await this.youtube.videos.list({
      part: ['contentDetails', 'statistics'],
      id: videoIds,
    });
    return res.data.items ?? [];
  }

  /** Yeni videoları DB'ye upsert eder */
  async syncVideos(): Promise<YoutubeSyncResult> {
    const items = await this.fetchLatestVideos();
    const videoIds = items
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => !!id);

    const details = await this.fetchVideoDetails(videoIds);
    const detailsMap = new Map(details.map((d) => [d.id, d]));

    let created = 0;
    let updated = 0;

    for (const item of items) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;

      const snippet = item.snippet;
      const detail = detailsMap.get(videoId);

      const data = {
        title: snippet?.title ?? 'Başlıksız Video',
        description: snippet?.description ?? null,
        thumbnailUrl:
          snippet?.thumbnails?.maxres?.url ??
          snippet?.thumbnails?.high?.url ??
          snippet?.thumbnails?.default?.url ??
          null,
        channelId: this.channelId,
        duration: detail?.contentDetails?.duration ?? null,
        viewCount: detail?.statistics?.viewCount
          ? parseInt(detail.statistics.viewCount, 10)
          : 0,
        publishedAt: new Date(snippet?.publishedAt ?? Date.now()),
      };

      const existing = await this.prisma.video.findUnique({
        where: { youtubeId: videoId },
      });

      if (existing) {
        await this.prisma.video.update({ where: { youtubeId: videoId }, data });
        updated++;
      } else {
        await this.prisma.video.create({ data: { youtubeId: videoId, ...data } });
        created++;
      }
    }

    this.logger.log(`YouTube sync: ${items.length} çekildi, ${created} yeni, ${updated} güncellendi`);

    await this.prisma.syncLog.create({
      data: {
        type: 'youtube',
        status: 'success',
        itemCount: items.length,
        message: `${created} yeni, ${updated} güncellendi`,
      },
    });

    return { fetched: items.length, created, updated };
  }
}
