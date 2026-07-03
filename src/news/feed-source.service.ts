import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedSourceDto } from './dto/create-feed-source.dto';
import { UpdateFeedSourceDto } from './dto/update-feed-source.dto';
import { NewsService } from './news.service';

@Injectable()
export class FeedSourceService {
  private readonly logger = new Logger(FeedSourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly newsService: NewsService,
  ) {}

  // ---------- CRUD ----------

  /** Tüm RSS kaynaklarını listele */
  async findAll() {
    return this.prisma.newsFeedSource.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Tek bir RSS kaynağını getir */
  async findOne(id: string) {
    const source = await this.prisma.newsFeedSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('RSS kaynağı bulunamadı');
    return source;
  }

  /** Yeni RSS kaynağı ekle */
  async create(dto: CreateFeedSourceDto) {
    const existing = await this.prisma.newsFeedSource.findUnique({
      where: { rssUrl: dto.rssUrl },
    });
    if (existing) {
      throw new ConflictException('Bu RSS URL zaten kayıtlı');
    }

    return this.prisma.newsFeedSource.create({
      data: {
        name: dto.name,
        rssUrl: dto.rssUrl,
        active: dto.active ?? true,
      },
    });
  }

  /** RSS kaynağını güncelle */
  async update(id: string, dto: UpdateFeedSourceDto) {
    await this.findOne(id); // 404 kontrolü

    // rssUrl değişiyorsa benzersizlik kontrolü
    if (dto.rssUrl) {
      const conflict = await this.prisma.newsFeedSource.findFirst({
        where: { rssUrl: dto.rssUrl, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Bu RSS URL başka bir kaynakta kullanılıyor');
    }

    return this.prisma.newsFeedSource.update({
      where: { id },
      data: dto,
    });
  }

  /** RSS kaynağını sil */
  async remove(id: string) {
    await this.findOne(id); // 404 kontrolü
    await this.prisma.newsFeedSource.delete({ where: { id } });
    return { message: 'RSS kaynağı silindi' };
  }

  /** Kaynağı aktif/pasif yap */
  async toggleActive(id: string) {
    const source = await this.findOne(id);
    const updated = await this.prisma.newsFeedSource.update({
      where: { id },
      data: { active: !source.active },
    });
    return {
      message: updated.active ? 'Kaynak aktif edildi' : 'Kaynak pasife alındı',
      source: updated,
    };
  }

  // ---------- Senkronizasyon ----------

  /**
   * Belirli bir kaynağı hemen senkronize et.
   * newsService.syncFromFeeds() tüm aktif kaynakları tarar;
   * burada tek kaynağı geçici olarak aktif ederek senkronu tetikliyoruz.
   */
  async syncOne(id: string) {
    const source = await this.findOne(id);
    this.logger.log(`Manuel senkron tetiklendi: ${source.name}`);

    // Kaynağı geçici olarak aktif et (zaten aktifse değişmez)
    const wasActive = source.active;
    if (!wasActive) {
      await this.prisma.newsFeedSource.update({
        where: { id },
        data: { active: true },
      });
    }

    // syncFromFeeds tüm aktif kaynakları tarar — bu yüzden önce
    // diğer aktif kaynakları geçici pasife al, senkronu yap, geri al
    // Daha basit yaklaşım: newsService'e tek kaynak senkronu metodu ekle
    const result = await this.newsService.syncSingleSource(id);

    if (!wasActive) {
      await this.prisma.newsFeedSource.update({
        where: { id },
        data: { active: false },
      });
    }

    return result;
  }

  // ---------- İstatistik ----------

  /** Senkron loglarını getir */
  async getSyncLogs(limit = 20) {
    return this.prisma.syncLog.findMany({
      where: { type: 'news_rss' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
