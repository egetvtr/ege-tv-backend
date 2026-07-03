import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();

async function main() {
  await prisma.category.createMany({
    data: [
      { name: 'Gündem', slug: 'gundem' },
      { name: 'Ekonomi', slug: 'ekonomi' },
      { name: 'Spor', slug: 'spor' },
      { name: 'Yerel', slug: 'yerel' },
    ],
    skipDuplicates: true,
  });

  // Örnek RSS kaynağı - kendi kaynaklarınla değiştir
  await prisma.newsFeedSource.upsert({
    where: { rssUrl: 'https://www.aa.com.tr/tr/rss/default?cat=guncel' },
    update: {},
    create: {
      name: 'Anadolu Ajansı - Güncel',
      rssUrl: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
      active: true,
    },
  });

  // Super Admin kullanıcısı oluştur (Şifre: admin123)
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.adminUser.upsert({
    where: { email: 'admin@egetv.com' },
    update: {},
    create: {
      email: 'admin@egetv.com',
      name: 'Ege TV Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Seed tamamlandı. Admin Kullanıcısı: admin@egetv.com | Şifre: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
