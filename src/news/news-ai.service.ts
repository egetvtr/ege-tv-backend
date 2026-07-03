import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface RewrittenNews {
  title: string;
  summary: string;
  content: string;
}

@Injectable()
export class NewsAiService {
  private readonly logger = new Logger(NewsAiService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
    this.model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-6');
  }

  /**
   * Ham bir kaynak haberi (RSS'ten gelen) Ege TV editoryal diliyle
   * yeniden yazar. Telif/kopyalama riskini azaltmak ve SEO için
   * özgün içerik üretmek amacıyla kullanılır.
   */
  async rewrite(rawTitle: string, rawContent: string, sourceName?: string): Promise<RewrittenNews> {
    const prompt = `Aşağıdaki haberi Ege TV editoryal diliyle, özgün cümlelerle yeniden yaz.
Kaynak: ${sourceName ?? 'bilinmiyor'}

Kurallar:
- Orijinal cümleleri birebir kopyalama, tamamen kendi cümlelerinle anlat
- Haber dilinde, tarafsız ve sade bir üslup kullan
- Türkçe yazım kurallarına dikkat et
- SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir açıklama ekleme:
{"title": "...", "summary": "iki cümlelik özet", "content": "tam haber metni, paragraflar arasında \\n\\n kullan"}

Başlık: ${rawTitle}

İçerik:
${rawContent}`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude API metin yanıtı döndürmedi');
    }

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
      };
    } catch (err) {
      this.logger.error(`AI yanıtı parse edilemedi: ${cleaned.slice(0, 200)}`);
      throw new Error('AI yeniden yazım yanıtı geçersiz JSON formatında');
    }
  }
}
