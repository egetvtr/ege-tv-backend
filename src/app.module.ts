import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { YoutubeModule } from './youtube/youtube.module';
import { NewsModule } from './news/news.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting: varsayılan 60 istek/dakika (IP başına)
    // .env'den THROTTLE_TTL (saniye) ve THROTTLE_LIMIT (istek) okunur
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([
        {
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000, // ms
          limit: config.get<number>('THROTTLE_LIMIT', 60),
        },
      ]),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Railway Redis eklentisi tek parça "REDIS_URL" verir (redis://:pass@host:port).
        // Varsa onu parse ediyoruz, yoksa host/port/password'a düşüyoruz (lokal geliştirme).
        const redisUrl = config.get<string>('REDIS_URL');
        const baseOptions = {
          enableOfflineQueue: false,
          maxRetriesPerRequest: null,
          lazyConnect: true,
        };
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            connection: {
              ...baseOptions,
              host: url.hostname,
              port: Number(url.port) || 6379,
              password: url.password || undefined,
            },
          };
        }
        return {
          connection: {
            ...baseOptions,
            host: config.get('REDIS_HOST', '127.0.0.1'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get('REDIS_PASSWORD') || undefined,
          },
        };
      },
    }),
    PrismaModule,
    YoutubeModule,
    NewsModule,
    CategoriesModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // ThrottlerGuard'ı tüm route'lara global olarak uygula
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
