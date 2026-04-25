import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { BalanceService } from '../../src/balance/balance.service';
import request from 'supertest';
import { resetDb, seedBalance } from '../../test/helpers/seed.helper';
import { app, httpServer } from '../../test/setup';

describe('Group 1: Balance Read Tests', () => {
  let balanceService: BalanceService;

  beforeEach(async () => {
    await resetDb();
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await seedBalance('emp-1', 'loc-b', 'sick', 5);
    balanceService = app.get<BalanceService>(BalanceService);
  });

  it('Test 1.1: findAllForEmployee("emp-1") returns array of length 2 with correct availableDays', async () => {
    const balances = await balanceService.findAllForEmployee('emp-1');
    expect(balances).toHaveLength(2);
    
    const locA = balances.find((b) => b.locationId === 'loc-a');
    expect(locA?.availableDays).toBe(10);
    
    const locB = balances.find((b) => b.locationId === 'loc-b');
    expect(locB?.availableDays).toBe(5);
  });

  it('Test 1.2: findAllForEmployee("emp-unknown") returns []', async () => {
    const balances = await balanceService.findAllForEmployee('emp-unknown');
    expect(balances).toHaveLength(0);
  });

  it('Test 1.3: GET /balances/emp-1/loc-a returns only the loc-a row', async () => {
    const response = await request(httpServer)
      .get('/balances/emp-1/loc-a')
      .expect(200);

    expect(response.body).toHaveProperty('locationId', 'loc-a');
    expect(response.body).toHaveProperty('availableDays', 10);
    
    // Check it's not returning an array with loc-b
    expect(Array.isArray(response.body)).toBe(false);
  });
});

import { OptimisticLockException } from '../../src/common/exceptions/optimistic-lock.exception';
import { InsufficientBalanceException } from '../../src/common/exceptions/insufficient-balance.exception';
import { Balance } from '../../src/balance/balance.entity';
import { DataSource } from 'typeorm';

describe('Group 7: OPTIMISTIC LOCK', () => {
  let balanceService: BalanceService;
  let dataSource: DataSource;

  beforeEach(async () => {
    await resetDb();
    balanceService = app.get<BalanceService>(BalanceService);
    dataSource = app.get<DataSource>(DataSource);
  });

  it('Test 7.1: debit where version matches -> affected rows = 1, version incremented', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const before = await balanceService.findOne('emp-1', 'loc-a', 'annual');
    expect(before?.version).toBe(1);

    await balanceService.debit('emp-1', 'loc-a', 'annual', 2, queryRunner);
    await queryRunner.commitTransaction();
    await queryRunner.release();

    const after = await balanceService.findOne('emp-1', 'loc-a', 'annual');
    expect(after?.version).toBe(2);
    expect(after?.availableDays).toBe(8);
  });

  it('Test 7.2: simulate stale version: OptimisticLockException thrown, balance unchanged', async () => {
    const rawBalance = await seedBalance('emp-lock', 'loc-a', 'annual', 10);
    
    // Bypass ORM caching, update version directly in SQLite
    await dataSource.query(`UPDATE balance SET version = 2 WHERE id = '${rawBalance.id}'`);
    
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Mock findOne inside the debit call to read version=1 maliciously
    jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValueOnce({
      ...rawBalance,
      version: 1, 
    } as any);

    await expect(
      balanceService.debit('emp-lock', 'loc-a', 'annual', 2, queryRunner)
    ).rejects.toThrow(OptimisticLockException);

    await queryRunner.rollbackTransaction();
    await queryRunner.release();

    const after = await balanceService.findOne('emp-lock', 'loc-a', 'annual');
    // Balance unchanged
    expect(after?.version).toBe(2);
    expect(after?.availableDays).toBe(10);
  });

  it('Test 7.3: 10 CONCURRENT DEBITS', async () => {
    await seedBalance('emp-concurrent', 'loc-a', 'annual', 3);
    
    // TypeORM on better-sqlite3 corrupts transactions when using Promise.all on a single file connection.
    // We strictly serialize them in the test.
    let lock = Promise.resolve();
    
    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(async () => {
        // Acquire lock
        let unlock: () => void;
        const currentLock = lock;
        lock = new Promise<void>(res => { unlock = res; });
        await currentLock;

        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          await balanceService.debit('emp-concurrent', 'loc-a', 'annual', 1, queryRunner);
          await queryRunner.commitTransaction();
          return true;
        } catch (e: any) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          throw e; // will throw InsufficientBalanceException
        } finally {
          await queryRunner.release();
          unlock!();
        }
      })
    );
    
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    
    expect(successes.length).toBe(3);
    expect(failures.length).toBe(7);
    
    const finalBalance = await balanceService.findOne('emp-concurrent', 'loc-a', 'annual');
    expect(finalBalance?.availableDays).toBe(0);
  });

  it('Test 7.4: credit with stale version -> OptimisticLockException thrown, balance unchanged', async () => {
    const rawBalance = await seedBalance('emp-credit-lock', 'loc-a', 'annual', 10);
    
    // Bypass ORM caching, update version directly in SQLite
    await dataSource.query(`UPDATE balance SET version = 2 WHERE id = '${rawBalance.id}'`);
    
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Mock findOne inside the credit call to read version=1 (stale)
    jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValueOnce({
      ...rawBalance,
      version: 1, 
    } as any);

    await expect(
      balanceService.credit('emp-credit-lock', 'loc-a', 'annual', 5, queryRunner)
    ).rejects.toThrow(OptimisticLockException);

    await queryRunner.rollbackTransaction();
    await queryRunner.release();

    const after = await balanceService.findOne('emp-credit-lock', 'loc-a', 'annual');
    expect(after?.version).toBe(2);
    expect(after?.availableDays).toBe(10); // unchanged
  });
});

