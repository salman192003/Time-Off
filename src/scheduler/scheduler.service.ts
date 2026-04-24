import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { SyncService } from '../sync/sync.service';
import { TimeOffRequest, RequestStatus } from '../entities/time-off-request.entity';
import { BalanceRecord } from '../entities/balance-record.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly syncService: SyncService,
    private readonly dataSource: DataSource,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(BalanceRecord)
    private readonly balanceRepository: Repository<BalanceRecord>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runBatchReconciliation() {
    this.logger.log('Starting Batch Reconciliation process...');
    
    try {
      const response = await firstValueFrom(
        this.httpService.get('http://localhost:3000/mock-hcm/batch')
      );

      const result = await this.syncService.processBatchSync(response.data);
      this.logger.log(`Batch Reconciliation complete. Updated: ${result.updated}, Auto-Rejected: ${result.rejected}`);
    } catch (error) {
      this.logger.error(`Batch Reconciliation failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryPendingRequests() {
    this.logger.log('Scanning for pending requests to process/retry...');

    // Find PENDING requests. We'll try to process any pending request,
    // especially those that may have failed previously (hcmError is not null).
    const pendingRequests = await this.requestRepository.find({
      where: { status: RequestStatus.PENDING }
    });

    if (pendingRequests.length === 0) {
      this.logger.debug('No pending requests found.');
      return;
    }

    this.logger.log(`Found ${pendingRequests.length} pending requests. Processing...`);

    for (const request of pendingRequests) {
      try {
        const payload = {
          employeeId: request.employeeId,
          locationId: request.locationId,
          days: request.days,
          requestId: request.id,
        };

        const response = await firstValueFrom(
          this.httpService.post('http://localhost:3000/mock-hcm/submit', payload)
        );

        if (response.data.success) {
          request.status = RequestStatus.APPROVED;
          request.hcmSubmittedAt = new Date();
          request.hcmError = null as any; // Typeorm deals with it when column is nullable
          await this.requestRepository.save(request);
          this.logger.log(`Request ${request.id} automatically APPROVED in HCM.`);
        }
      } catch (error) {
        const status = error.response?.status;
        
        if (status === 400) {
          // Insufficient balance in HCM
          await this.dataSource.transaction(async (manager) => {
            request.status = RequestStatus.REJECTED;
            request.hcmError = error.response?.data?.message || 'Insufficient balance';
            
            await manager.save(TimeOffRequest, request);
  
            // Release the pending reservation
            const balance = await manager.findOne(BalanceRecord, {
              where: { employeeId: request.employeeId, locationId: request.locationId }
            });
            
            if (balance) {
              await manager.update(BalanceRecord, 
                { id: balance.id, version: balance.version },
                { pendingDays: balance.pendingDays - request.days, version: balance.version + 1 }
              );
            }
          });

          this.logger.warn(`Request ${request.id} REJECTED due to 400 from HCM. Reservation released.`);
        } else {
          // 500 error or network error, transient failure, leave it PENDING
          request.hcmError = error.message || 'Transient HCM error';
          await this.requestRepository.save(request);
          this.logger.error(`Request ${request.id} transient failure (Status: ${status}). Will retry later.`);
        }
      }
    }
  }
}
