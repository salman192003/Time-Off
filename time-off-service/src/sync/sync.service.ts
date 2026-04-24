import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest, RequestStatus } from '../entities/time-off-request.entity';
import { SyncLog, SyncType, SyncStatus } from '../entities/sync-log.entity';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookSyncDto } from './dto/webhook-sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(BalanceRecord)
    private readonly balanceRepository: Repository<BalanceRecord>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  private async reconcileEmployeeBalance(
    manager: EntityManager,
    employeeId: string,
    locationId: string,
    availableDays: number,
  ): Promise<{ rejectedRequests: number }> {
    let balance = await manager.findOne(BalanceRecord, {
      where: { employeeId, locationId },
      // SQLite does not support pessimistic locks natively through driver
      // lock: { mode: 'pessimistic_write' }
    });

    if (!balance) {
      balance = manager.create(BalanceRecord, {
        employeeId,
        locationId,
        availableDays,
        pendingDays: 0,
        lastSyncedAt: new Date(),
      });
    } else {
      balance.availableDays = availableDays;
      balance.lastSyncedAt = new Date();
    }

    await manager.save(BalanceRecord, balance);

    let rejectedCount = 0;

    // Conflict Resolution Phase
    if (balance.availableDays - balance.pendingDays < 0) {
      const pendingRequests = await manager.find(TimeOffRequest, {
        where: { employeeId, locationId, status: RequestStatus.PENDING },
        order: { createdAt: 'ASC' },
      });

      const requestsToUpdate: TimeOffRequest[] = [];

      for (const request of pendingRequests) {
        if (balance.availableDays - balance.pendingDays >= 0) break; // Reached equilibrium
        
        request.status = RequestStatus.REJECTED;
        balance.pendingDays -= request.days;
        requestsToUpdate.push(request);
        rejectedCount++;
      }

      if (requestsToUpdate.length > 0) {
        await manager.save(TimeOffRequest, requestsToUpdate);
        await manager.save(BalanceRecord, balance);
      }
    }

    return { rejectedRequests: rejectedCount };
  }

  async processBatchSync(dto: BatchSyncDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let totalRejected = 0;
    
    try {
      for (const record of dto.records) {
        const { rejectedRequests } = await this.reconcileEmployeeBalance(
          queryRunner.manager,
          record.employeeId,
          record.locationId,
          record.availableDays,
        );
        totalRejected += rejectedRequests;
      }

      const syncLog = queryRunner.manager.create(SyncLog, {
        type: SyncType.BATCH,
        triggeredBy: 'scheduler',
        affectedEmployees: dto.records.length,
        requestsRevalidated: 0, // Implement if needed
        requestsAutoRejected: totalRejected,
        status: SyncStatus.SUCCESS,
      });
      await queryRunner.manager.save(SyncLog, syncLog);

      await queryRunner.commitTransaction();
      return { success: true, updated: dto.records.length, rejected: totalRejected };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      // Log the failure
      const syncLog = this.syncLogRepository.create({
        type: SyncType.BATCH,
        triggeredBy: 'scheduler',
        affectedEmployees: dto.records.length,
        requestsRevalidated: 0,
        requestsAutoRejected: 0,
        status: SyncStatus.FAILED,
        errorDetail: error instanceof Error ? error.message : String(error),
      });
      await this.syncLogRepository.save(syncLog);
      
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processWebhook(dto: WebhookSyncDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { rejectedRequests } = await this.reconcileEmployeeBalance(
        queryRunner.manager,
        dto.employeeId,
        dto.locationId,
        dto.availableDays,
      );

      const syncLog = queryRunner.manager.create(SyncLog, {
        type: SyncType.WEBHOOK,
        triggeredBy: 'hcm-webhook',
        affectedEmployees: 1,
        requestsRevalidated: 0,
        requestsAutoRejected: rejectedRequests,
        status: SyncStatus.SUCCESS,
      });
      await queryRunner.manager.save(SyncLog, syncLog);

      await queryRunner.commitTransaction();
      return { success: true, updated: 1, rejected: rejectedRequests };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      const syncLog = this.syncLogRepository.create({
        type: SyncType.WEBHOOK,
        triggeredBy: 'hcm-webhook',
        affectedEmployees: 1,
        requestsRevalidated: 0,
        requestsAutoRejected: 0,
        status: SyncStatus.FAILED,
        errorDetail: error instanceof Error ? error.message : String(error),
      });
      await this.syncLogRepository.save(syncLog);
      
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
