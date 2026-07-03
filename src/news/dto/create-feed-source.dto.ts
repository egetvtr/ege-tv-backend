import {
  IsString,
  IsUrl,
  MinLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedSourceDto {
  @ApiProperty({ example: 'Anadolu Ajansı', description: 'Kaynak adı' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    example: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
    description: 'RSS feed URL\'si',
  })
  @IsUrl({}, { message: 'Geçerli bir URL giriniz' })
  rssUrl: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Aktif mi?' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
