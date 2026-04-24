import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WebhookSyncDto } from './webhook-sync.dto';

export class BatchSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookSyncDto)
  records: WebhookSyncDto[];
}
