import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { SyncSchedulerService } from './sync-scheduler.service';
import { resetDb, resetHcm, seedBalance, configureHcm } from '../../test/helpers/seed.helper';
import { app, httpServer } from '../../test/setup';
import request from 'supertest';

describe('Group 6: Scheduler (sync-scheduler.service.spec.ts — Integration)', () => {
  let scheduler: SyncSchedulerService;

  beforeAll(async () => {
    scheduler = app.get<SyncSchedulerService>(SyncSchedulerService);
  });

  beforeEach(async () => {
    await resetDb();
    await resetHcm();
  });

  it('Test 6.1: manually invoke scheduledReconciliation() all 3 balances updated, SyncLog created', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 5);
    await seedBalance('emp-2', 'loc-b', 'sick', 5);
    await seedBalance('emp-3', 'loc-c', 'paternity', 5);

    // Mock HCM batch returns 3 records
    await request(httpServer).post('/mock-hcm/seed').send({
      records: [
        { employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 10 },
        { employeeId: 'emp-2', locationId: 'loc-b', leaveType: 'sick', availableDays: 12 },
        { employeeId: 'emp-3', locationId: 'loc-c', leaveType: 'paternity', availableDays: 14 }
      ]
    });

    await scheduler.scheduledReconciliation();

    const bal1 = await request(httpServer).get('/balances/emp-1/loc-a');
    const bal2 = await request(httpServer).get('/balances/emp-2/loc-b');
    const bal3 = await request(httpServer).get('/balances/emp-3/loc-c');
    expect(bal1.body.availableDays).toBe(10);
    expect(bal2.body.availableDays).toBe(12);
    expect(bal3.body.availableDays).toBe(14);

    const logsRes = await request(httpServer).get('/sync/logs');
    const log = logsRes.body[0];
    expect(log).toBeDefined();
    expect(log.source).toBe('BATCH');
    expect(log.status).toBe('SUCCESS');
    expect(log.recordsProcessed).toBe(3);
  });

  it('Test 6.2: manually invoke scheduledReconciliation() while HCM batch returns 503 -> FAILURE, local unchanged', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 5);
    
    // Force HCM to fail
    await configureHcm({ forceError: true });

    await scheduler.scheduledReconciliation();

    const bal1 = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(bal1.body.availableDays).toBe(5); // unchanged

    const logsRes = await request(httpServer).get('/sync/logs');
    const log = logsRes.body[0];
    expect(log).toBeDefined();
    expect(log.source).toBe('BATCH');
    expect(log.status).toBe('FAILURE');
    expect(log.recordsProcessed).toBe(0);
  });
});
