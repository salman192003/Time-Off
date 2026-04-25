import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimeOffRequest, RequestStatus } from './request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { BalanceService } from '../balance/balance.service';
import { HcmClient } from '../hcm/hcm.client';
import { SyncService } from '../sync/sync.service';
import { ConflictException } from '../common/exceptions/conflict.exception';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClient,
    private readonly syncService: SyncService,
  ) {}

  async create(dto: CreateRequestDto): Promise<TimeOffRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let newRequest: TimeOffRequest;

    try {
      await this.balanceService.debit(
        dto.employeeId,
        dto.locationId,
        dto.leaveType,
        dto.daysRequested,
        queryRunner,
      );

      const req = this.requestRepo.create({
        ...dto,
        status: RequestStatus.PENDING,
      });

      newRequest = await queryRunner.manager.save(TimeOffRequest, req);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }

    try {
      await this.hcmClient.applyDebit(
        dto.employeeId,
        dto.locationId,
        dto.leaveType,
        dto.daysRequested,
      );
    } catch (error) {
      const compRunner = this.dataSource.createQueryRunner();
      await compRunner.connect();
      await compRunner.startTransaction();

      try {
        await this.balanceService.credit(
          dto.employeeId,
          dto.locationId,
          dto.leaveType,
          dto.daysRequested,
          compRunner,
        );

        newRequest.status = RequestStatus.FAILED_HCM_VALIDATION;
        await compRunner.manager.save(TimeOffRequest, newRequest);

        await compRunner.commitTransaction();
      } catch (err) {
        await compRunner.rollbackTransaction();
        throw err;
      } finally {
        await compRunner.release();
      }
    }

    return newRequest;
  }

  async approve(id: string, managerId: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.employeeId === managerId) {
      throw new ForbiddenException('A requesting employee cannot approve their own requests');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Request is not in PENDING status');
    }

    request.status = RequestStatus.APPROVED;
    request.managerId = managerId;
    request.resolvedAt = new Date();

    const savedRequest = await this.requestRepo.save(request);

    await this.syncService.applyDeferredSync(
      request.employeeId,
      request.locationId,
      request.leaveType,
    );

    return savedRequest;
  }

  async reject(id: string, managerId: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Request is not in PENDING status');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.balanceService.credit(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.daysRequested,
        queryRunner,
      );

      request.status = RequestStatus.REJECTED;
      request.managerId = managerId;
      request.resolvedAt = new Date();

      await queryRunner.manager.save(TimeOffRequest, request);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.syncService.applyDeferredSync(
      request.employeeId,
      request.locationId,
      request.leaveType,
    );

    return request;
  }

  async cancel(id: string, requestingEmployeeId: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.employeeId !== requestingEmployeeId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Request is not in PENDING status');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.balanceService.credit(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.daysRequested,
        queryRunner,
      );

      request.status = RequestStatus.CANCELLED;
      request.resolvedAt = new Date();

      await queryRunner.manager.save(TimeOffRequest, request);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.syncService.applyDeferredSync(
      request.employeeId,
      request.locationId,
      request.leaveType,
    );

    return request;
  }

  async findById(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async findAll(filters: { employeeId?: string; status?: RequestStatus }): Promise<TimeOffRequest[]> {
    const where: any = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;

    return this.requestRepo.find({ where });
  }
}
