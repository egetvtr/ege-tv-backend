import { Module } from '@nestjs/common';
import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import slugify from 'slugify';

class CreateCategoryDto {
  @ApiProperty({ example: 'Spor' })
  @IsString()
  @MinLength(2)
  name: string;
}

@ApiTags('categories')
@Controller('categories')
class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  // ---- PUBLIC ----

  @Get()
  @ApiOperation({ summary: 'Tüm kategorileri listele' })
  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Kategori detayı (slug ile)' })
  findOne(@Param('slug') slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  // ---- ADMIN (JWT token gerekli) ----

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.EDITOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Yeni kategori oluştur' })
  async create(@Body() dto: CreateCategoryDto) {
    const slug = slugify(dto.name, { lower: true, strict: true, locale: 'tr' });
    return this.prisma.category.create({ data: { name: dto.name, slug } });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin][SUPER_ADMIN] Kategori sil' })
  async remove(@Param('id') id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Kategori silindi' };
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
