import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest, RequestStatus } from '../entities/time-off-request.entity';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateStatusDto, UpdateRequestStatus } from './dto/update-status.dto';

@Injectable()
export class TimeoffService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BalanceRecord)
    private readonly balanceRepository: Repository<BalanceRecord>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
  ) {}

  async getBalance(employeeId: string, locationId: string) {
    const record = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!record) {
      throw new NotFoundException('Balance record not found');
    }

    return {
      ...record,
      effectiveBalance: record.availableDays - record.pendingDays,
    };
  }

  async createRequest(dto: CreateTimeOffRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const balance = await queryRunner.manager.findOne(BalanceRecord, {
        where: { employeeId: dto.employeeId, locationId: dto.locationId },
      });

      if (!balance) {
        throw new NotFoundException('Balance record not found');
      }

      const effectiveBalance = balance.availableDays - balance.pendingDays;
      
      if (effectiveBalance < dto.days) {
        throw new BadRequestException('Insufficient local balance');
      }

      // Concurrency delay to test race conditions
      await new Promise(resolve => setTimeout(resolve, 50)); 

      const updateResult = await queryRunner.manager.update(
        BalanceRecord,
        { 
          id: balance.id, 
          version: balance.version 
        },
        { 
          pendingDays: balance.pendingDays + dto.days,
          version: balance.version + 1 
        }
      );

      if (updateResult.affected === 0) {
        throw new ConflictException('Data was modified concurrently');
      }

      const request = queryRunner.manager.create(TimeOffRequest, {
        ...dto,
        status: RequestStatus.PENDING,
      });
      
      const savedRequest = await queryRunner.manager.save(TimeOffRequest, request);
      
      await queryRunner.commitTransaction();
      return savedRequest;
    } catch (error) {
      // Avoid rollback error if transaction wasn't active
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getRequest(id: string) {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async updateRequestStatus(id: string, dto: UpdateStatusDto) {
    const request = await this.getRequest(id);
    
    if (dto.status === UpdateRequestStatus.REJECTED && request.status !== RequestStatus.REJECTED) {
      const balance = await this.balanceRepository.findOne({
        where: { employeeId: request.employeeId, locationId: request.locationId },
      });
      
      if (balance) {
        balance.pendingDays -= request.days;
        await this.balanceRepository.save(balance);
      }
    }
    
    request.status = dto.status as unknown as RequestStatus;
    return await this.requestRepository.save(request);
  }
}
