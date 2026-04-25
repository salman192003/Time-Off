import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { HcmClient } from '../hcm/hcm.client';
import { SyncLog, SyncSource, SyncStatus } from './sync-log.entity';
import { TimeOffRequest, RequestStatus } from '../request/request.entity';
import { ConflictException } from '../common/exceptions/conflict.exception';
import type { HcmBalanceRecord } from '../hcm/hcm.client';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClient,
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
  ) {}

  async processBatch(records: HcmBalanceRecord[]): Promise<SyncLog> {
    let processed = 0;
    const errors: any[] = [];

    for (const record of records) {
      const { employeeId, locationId, leaveType, availableDays } = record;

      const pendingRequest = await this.requestRepo.findOne({
        where: { employeeId, locationId, leaveType, status: RequestStatus.PENDING },
      });

      if (pendingRequest) {
        errors.push({
          deferred: true,
          employeeId,
          locationId,
          leaveType,
          hcmDays: availableDays,
        });
        continue;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await this.balanceService.upsertFromHcm(
          employeeId,
          locationId,
          leaveType,
          availableDays,
          queryRunner,
        );
        await queryRunner.commitTransaction();
        processed++;
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        errors.push({
          employeeId,
          locationId,
          leaveType,
          error: err.message,
        });
      } finally {
        await queryRunner.release();
      }
    }

    const log = this.syncLogRepo.create({
      source: SyncSource.BATCH,
      status: errors.length > 0 ? (processed > 0 ? SyncStatus.PARTIAL : SyncStatus.FAILURE) : SyncStatus.SUCCESS,
      recordsProcessed: processed,
      errors: errors.length > 0 ? errors : undefined,
    });

    return this.syncLogRepo.save(log);
  }

  async processRealtimeUpdate(employeeId: string, locationId: string, leaveType: string, hcmDays: number): Promise<void> {
    const pendingRequests = await this.requestRepo.find({
      where: { employeeId, locationId, leaveType, status: RequestStatus.PENDING },
    });

    if (pendingRequests.length > 0) {
      const log = this.syncLogRepo.create({
        source: SyncSource.REALTIME,
        status: SyncStatus.SUCCESS,
        recordsProcessed: 0,
        errors: {
          deferred: true,
          employeeId, locationId, leaveType, hcmDays
        }
      });
      await this.syncLogRepo.save(log);

      const totalPendingDays = pendingRequests.reduce((sum, req) => sum + Number(req.daysRequested), 0);
      if (hcmDays - totalPendingDays < 0) {
        const errorLog = this.syncLogRepo.create({
           source: SyncSource.REALTIME,
           status: SyncStatus.FAILURE,
           recordsProcessed: 0,
           errors: {
             manualReviewRequired: true,
             reason: 'Balance below 0 after pending deductions',
             employeeId, locationId, leaveType, hcmDays, totalPendingDays
           }
        });
        await this.syncLogRepo.save(errorLog);
        this.logger.error(`ConflictException: employeeId=${employeeId} balance below 0 after applying pending deductions`);
      }

      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let success = false;
    try {
      await this.balanceService.upsertFromHcm(
        employeeId,
        locationId,
        leaveType,
        hcmDays,
        queryRunner,
      );
      await queryRunner.commitTransaction();
      success = true;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      const log = this.syncLogRepo.create({
        source: SyncSource.REALTIME,
        status: SyncStatus.FAILURE,
        recordsProcessed: 0,
        errors: {
          employeeId, locationId, leaveType, error: err.message
        }
      });
      await this.syncLogRepo.save(log);
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (success) {
      const log = this.syncLogRepo.create({
        source: SyncSource.REALTIME,
        status: SyncStatus.SUCCESS,
        recordsProcessed: 1,
      });
      await this.syncLogRepo.save(log);
    }
  }

  async applyDeferredSync(employeeId: string, locationId: string, leaveType: string): Promise<void> {
    const logs = await this.syncLogRepo.find({
       order: { triggeredAt: 'DESC' },
       take: 50
    });

    const deferredLog = logs.find(log => {
      const errors: any = log.errors;
      if (!errors) return false;
      const arr = Array.isArray(errors) ? errors : [errors];
      return arr.some((e: any) => e.deferred &&
             e.employeeId === employeeId &&
             e.locationId === locationId &&
             e.leaveType === leaveType &&
             !e.resolvedAt);
    });

    if (!deferredLog) return;
    const errors: any = deferredLog.errors;
    const arr = Array.isArray(errors) ? errors : [errors];
    const deferredEntry = arr.find((e: any) => e.deferred && e.employeeId === employeeId && e.locationId === locationId && e.leaveType === leaveType && !e.resolvedAt);
    
    const hcmDays = Number(deferredEntry.hcmDays);

    const unresolvedRequests = await this.requestRepo.createQueryBuilder('req')
      .where('req.employeeId = :employeeId', { employeeId })
      .andWhere('req.locationId = :locationId', { locationId })
      .andWhere('req.leaveType = :leaveType', { leaveType })
      .andWhere('(req.status = :pending OR (req.status = :approved AND req.resolvedAt >= :triggeredAt))', {
        pending: RequestStatus.PENDING,
        approved: RequestStatus.APPROVED,
        triggeredAt: deferredLog.triggeredAt,
      })
      .getMany();

    const sumPending = unresolvedRequests.reduce((sum, req) => sum + Number(req.daysRequested), 0);
    const effectiveDays = hcmDays - sumPending;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.balanceService.upsertFromHcm(employeeId, locationId, leaveType, effectiveDays, queryRunner);
      await queryRunner.commitTransaction();
      
      deferredEntry.resolvedAt = new Date().toISOString();
      deferredLog.errors = errors;
      await this.syncLogRepo.save(deferredLog);
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`applyDeferredSync failed: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async getLogs(): Promise<SyncLog[]> {
    return this.syncLogRepo.find({ order: { triggeredAt: 'DESC' } });
  }
}
