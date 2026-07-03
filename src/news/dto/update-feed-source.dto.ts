import { PartialType } from '@nestjs/swagger';
import { CreateFeedSourceDto } from './create-feed-source.dto';

export class UpdateFeedSourceDto extends PartialType(CreateFeedSourceDto) {}
