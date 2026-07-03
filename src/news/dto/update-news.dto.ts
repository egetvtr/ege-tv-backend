import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateNewsDto } from './create-news.dto';

enum NewsStatusDto {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @IsOptional()
  @IsEnum(NewsStatusDto)
  status?: NewsStatusDto;
}
