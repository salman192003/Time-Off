import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Balance } from './balance.entity';
import { InsufficientBalanceException } from '../common/exceptions/insufficient-balance.exception';
import { OptimisticLockException } from '../common/exceptions/optimistic-lock.exception';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
  ) {}

  async findAllForEmployee(employeeId: string): Promise<Balance[]> {
    return this.balanceRepo.find({ where: { employeeId } });
  }

  async findOne(employeeId: string, locationId: string, leaveType: string): Promise<Balance | null> {
    return this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType },
    });
  }

  async debit(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
    queryRunner: QueryRunner,
  ): Promise<Balance> {
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { employeeId, locationId, leaveType },
    });

    if (!balance) {
      throw new InsufficientBalanceException('Balance record not found');
    }

    if (Number(balance.availableDays) - days < 0) {
      throw new InsufficientBalanceException();
    }

    const expectedVersion = balance.version;
    const result = await queryRunner.manager.update(
      Balance,
      { id: balance.id, version: expectedVersion },
      {
        availableDays: () => `availableDays - ${days}`,
        version: expectedVersion + 1,
      },
    );

    if (result.affected === 0) {
      throw new OptimisticLockException();
    }

    return queryRunner.manager.findOne(Balance, { where: { id: balance.id } }) as Promise<Balance>;
  }

  async credit(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
    queryRunner: QueryRunner,
  ): Promise<Balance> {
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { employeeId, locationId, leaveType },
    });

    if (!balance) {
      // If it doesn't exist, we might want to create it, but the instruction doesn't explicitly mention creation on credit.
      // Assuming it must exist for a request to have been made.
      throw new Error('Balance record not found for credit');
    }

    const expectedVersion = balance.version;
    const result = await queryRunner.manager.update(
      Balance,
      { id: balance.id, version: expectedVersion },
      {
        availableDays: () => `availableDays + ${days}`,
        version: expectedVersion + 1,
      },
    );

    if (result.affected === 0) {
      throw new OptimisticLockException();
    }

    return queryRunner.manager.findOne(Balance, { where: { id: balance.id } }) as Promise<Balance>;
  }

  async upsertFromHcm(
    employeeId: string,
    locationId: string,
    leaveType: string,
    hcmDays: number,
    queryRunner: QueryRunner,
  ): Promise<Balance> {
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { employeeId, locationId, leaveType },
    });

    if (balance) {
      const expectedVersion = balance.version;
      const result = await queryRunner.manager.update(
        Balance,
        { id: balance.id, version: expectedVersion },
        {
          availableDays: hcmDays,
          version: expectedVersion + 1,
          lastSyncedAt: new Date(),
        },
      );

      if (result.affected === 0) {
        throw new OptimisticLockException();
      }
      return queryRunner.manager.findOne(Balance, { where: { id: balance.id } }) as Promise<Balance>;
    } else {
      const newBalance = queryRunner.manager.create(Balance, {
        employeeId,
        locationId,
        leaveType,
        availableDays: hcmDays,
        version: 1,
        lastSyncedAt: new Date(),
      });
      return queryRunner.manager.save(Balance, newBalance);
    }
  }
}
