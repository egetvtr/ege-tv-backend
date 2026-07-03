import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RssParser = require('rss-parser');
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { NewsAiService } from './news-ai.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly rssParser = new RssParser();
  private readonly autoPublish: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: NewsAiService,
    private readonly config: ConfigService,
  ) {
    this.autoPublish = this.config.get<string>('NEWS_AUTO_PUBLISH', 'false') === 'true';
  }

  // ---------- MANUEL GİRİŞ (admin panel) ----------

  async createManual(dto: CreateNewsDto, authorId: string) {
    const slug = await this.generateUniqueSlug(dto.title);
    return this.prisma.news.create({
      data: {
        ...dto,
        slug,
        source: 'MANUAL',
        status: 'PENDING', // admin onayından geçsin, sonra publish edilir
        authorId,
      },
    });
  }

  async update(id: string, dto: UpdateNewsDto) {
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news) throw new NotFoundException('Haber bulunamadı');

    const data: any = { ...dto };
    if (dto.status === 'PUBLISHED' && !news.publishedAt) {
      data.publishedAt = new Date();
    }

    return this.prisma.news.update({ where: { id }, data });
  }

  async publish(id: string) {
    return this.update(id, { status: 'PUBLISHED' as any });
  }

  async reject(id: string) {
    return this.update(id, { status: 'REJECTED' as any });
  }

  // ---------- PUBLIC LISTELEME ----------

  async listPublished(page = 1, limit = 20, categorySlug?: string) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'PUBLISHED' };
    if (categorySlug) where.category = { slug: categorySlug };

    const [items, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: { category: true },
      }),
      this.prisma.news.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Admin panel: tüm haberleri (DRAFT dahil) filtreli listele */
  async listAll(page = 1, limit = 20, status?: string, categorySlug?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (categorySlug) where.category = { slug: categorySlug };

    const [items, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { category: true, author: { select: { name: true } } },
      }),
      this.prisma.news.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findBySlug(slug: string) {
    const news = await this.prisma.news.findUnique({
      where: { slug },
      include: { category: true, author: { select: { name: true } } },
    });
    if (!news || news.status !== 'PUBLISHED') {
      throw new NotFoundException('Haber bulunamadı');
    }
    return news;
  }

  // ---------- OTOMATİK RSS + AI YENİDEN YAZIM ----------

  /** Aktif tüm RSS kaynaklarını tarar, yeni haberleri AI ile yeniden yazıp kaydeder */
  async syncFromFeeds(): Promise<{ processed: number; created: number }> {
    const sources = await this.prisma.newsFeedSource.findMany({ where: { active: true } });
    let processed = 0;
    let created = 0;

    for (const source of sources) {
      const result = await this.processSource(source);
      processed += result.processed;
      created += result.created;
    }

    await this.prisma.syncLog.create({
      data: {
        type: 'news_rss',
        status: 'success',
        itemCount: created,
        message: `${processed} tarandı, ${created} yeni`,
      },
    });

    return { processed, created };
  }

  /** Tek bir RSS kaynağını ID'ye göre hemen senkronize eder */
  async syncSingleSource(sourceId: string): Promise<{ processed: number; created: number; sourceName: string }> {
    const source = await this.prisma.newsFeedSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error(`Kaynak bulunamadı: ${sourceId}`);

    const result = await this.processSource(source);

    await this.prisma.syncLog.create({
      data: {
        type: 'news_rss',
        status: 'success',
        itemCount: result.created,
        message: `[${source.name}] ${result.processed} tarandı, ${result.created} yeni`,
      },
    });

    return { ...result, sourceName: source.name };
  }

  // ---------- YARDIMCI ----------

  /** Tek bir kaynağı tarar, yeni haberleri AI ile yeniden yazıp kaydeder */
  private async processSource(
    source: { id: string; name: string; rssUrl: string },
  ): Promise<{ processed: number; created: number }> {
    let processed = 0;
    let created = 0;

    try {
      const feed = await this.rssParser.parseURL(source.rssUrl);

      for (const item of feed.items) {
        processed++;
        if (!item.link) continue;

        const exists = await this.prisma.news.findFirst({ where: { sourceUrl: item.link } });
        if (exists) continue;

        const fullContent = item['content:encoded'] || item.content || item.contentSnippet || '';
        const rawContent = item['content:encodedSnippet'] || item.contentSnippet || item.content || item.title || '';
        if (rawContent.length < 30) continue; // çok kısa içerikleri atla

        let title = item.title ?? '';
        let summary = item.contentSnippet || item.content || '';
        let content = fullContent;
        let aiRewritten = false;

        try {
          const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
          if (apiKey && apiKey !== 'your_anthropic_api_key_here' && apiKey.trim() !== '') {
            const rewritten = await this.ai.rewrite(title, rawContent, source.name);
            title = rewritten.title;
            summary = rewritten.summary;
            content = rewritten.content;
            aiRewritten = true;
          }
        } catch (err: any) {
          this.logger.warn(`AI yeniden yazım başarısız, orijinal içerik kullanılıyor: ${err.message}`);
        }

        const slug = await this.generateUniqueSlug(title);

        // Extract image from enclosure or media content if available
        let coverImageUrl: string | null = null;
        if (item.enclosure && item.enclosure.url) {
          coverImageUrl = item.enclosure.url;
        } else if (item.image && item.image.url) {
          coverImageUrl = item.image.url;
        } else if (item.enclosure?.url) {
          coverImageUrl = item.enclosure.url;
        }

        await this.prisma.news.create({
          data: {
            title,
            slug,
            summary: summary.slice(0, 500),
            content,
            coverImageUrl,
            source: 'AUTO',
            sourceUrl: item.link,
            sourceName: source.name,
            aiRewritten,
            status: this.autoPublish ? 'PUBLISHED' : 'PENDING',
            publishedAt: this.autoPublish ? new Date() : null,
          },
        });
        created++;
      }

      await this.prisma.newsFeedSource.update({
        where: { id: source.id },
        data: { lastFetch: new Date() },
      });
    } catch (error) {
      this.logger.error(`RSS kaynak hatası (${source.name}): ${error.message}`);
    }

    return { processed, created };
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, locale: 'tr' });
    let slug = base;
    let counter = 1;
    while (await this.prisma.news.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }
}

