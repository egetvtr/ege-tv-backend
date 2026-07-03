import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Netlify'daki frontend + lokal geliştirme origin'lerine izin ver.
  // FRONTEND_URL'e virgülle ayrılmış birden fazla domain eklenebilir.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Ege TV API')
    .setDescription('YouTube senkron + AI destekli haber platformu')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Railway container'ları PORT değişkenini enjekte eder ve 0.0.0.0'a
  // bind edilmesini bekler (sadece localhost'a bind edilirse sağlık
  // kontrolü/route'lama başarısız olur).
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Ege TV backend çalışıyor: port ${port}`);
  console.log(`📚 Swagger docs: /api/docs`);
}
bootstrap();
