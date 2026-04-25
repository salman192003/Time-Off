import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HcmClient } from '../hcm/hcm.client';
import { SyncService } from './sync.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLog, SyncSource, SyncStatus } from './sync-log.entity';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly hcmClient: HcmClient,
    private readonly syncService: SyncService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
  ) {}

  @Cron('0 2 * * *')
  async scheduledReconciliation(): Promise<void> {
    this.logger.log('Starting scheduled reconciliation at 2am');
    try {
      const records = await this.hcmClient.getBatchBalances();
      const log = await this.syncService.processBatch(records);
      this.logger.log(`Scheduled reconciliation finished. Processed: ${log.recordsProcessed}, Status: ${log.status}`);
    } catch (err: any) {
      this.logger.error(`Scheduled reconciliation failed: ${err.message}`);
      const log = this.syncLogRepo.create({
        source: SyncSource.BATCH,
        status: SyncStatus.FAILURE,
        recordsProcessed: 0,
        errors: { reason: 'HCM Service Unavailable', message: err.message },
      });
      await this.syncLogRepo.save(log);
    }
  }
}
