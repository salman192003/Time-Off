import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookSyncDto } from './dto/webhook-sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  processBatchSync(@Body(new ValidationPipe({ transform: true })) dto: BatchSyncDto) {
    return this.syncService.processBatchSync(dto);
  }

  @Post('webhook')
  processWebhook(@Body(ValidationPipe) dto: WebhookSyncDto) {
    return this.syncService.processWebhook(dto);
  }
}
