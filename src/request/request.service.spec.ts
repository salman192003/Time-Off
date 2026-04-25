import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';
import { resetDb, resetHcm, seedBalance, seedHcmBalance, configureHcm } from '../../test/helpers/seed.helper';
import { app, httpServer } from '../../test/setup';
import { DataSource } from 'typeorm';

describe('Group 2: Request Creation (Validation + Integration)', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    await resetDb();
    await resetHcm();
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await seedHcmBalance('emp-1', 'loc-a', 'annual', 10);
    dataSource = app.get(DataSource);
  });

  const postRequest = (payload: any) => {
    return request(httpServer).post('/requests').send(payload);
  };

  it('Test 2.1: create valid request (8 days) -> status PENDING, balance becomes 2', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 8, startDate: '2025-01-01', endDate: '2025-01-08' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    
    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(2);
  });

  it('Test 2.2: create request for exactly 10 days -> succeeds, balance becomes 0', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 10, startDate: '2025-01-01', endDate: '2025-01-10' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    
    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(0);
  });

  it('Test 2.3: create request for 10.5 days -> throws InsufficientBalanceException (422)', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 10.5, startDate: '2025-01-01', endDate: '2025-01-10' });
    expect(res.status).toBe(422);
    
    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10);
  });

  it('Test 2.4: create request with daysRequested = 0 -> throws 400 (validation)', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 0, startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(res.status).toBe(400);
  });

  it('Test 2.5: create request with daysRequested = -1 -> throws 400 (validation)', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: -1, startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(res.status).toBe(400);
  });

  it('Test 2.6: create request for non-existent locationId -> throws 422', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-unknown', leaveType: 'annual', daysRequested: 1, startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(res.status).toBe(422);
  });

  it('Test 2.7: create request with leaveType = "" (empty string) -> throws 400 (validation)', async () => {
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: '', daysRequested: 1, startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(res.status).toBe(400);
  });

  it('Test 2.8 — CONCURRENCY (critical): balance=3, fire 3x1 + 1x2', async () => {
    await resetDb();
    await seedBalance('emp-1', 'loc-a', 'annual', 3);
    await seedHcmBalance('emp-1', 'loc-a', 'annual', 3);

    const baseReq = { employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', startDate: '2025-01-01', endDate: '2025-01-01' };
    
    const results = await Promise.allSettled([
      postRequest({ ...baseReq, daysRequested: 1 }),
      postRequest({ ...baseReq, daysRequested: 1 }),
      postRequest({ ...baseReq, daysRequested: 1 }),
      postRequest({ ...baseReq, daysRequested: 2 }),
    ]);

    const resolved = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const successes = resolved.filter(r => r.value.status === 201);
    
    let totalGranted = 0;
    for (const s of successes) {
      totalGranted += s.value.body.daysRequested;
    }
    
    expect(totalGranted).toBeLessThanOrEqual(3);

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBeGreaterThanOrEqual(0);
    expect(balanceRes.body.availableDays).toBe(3 - totalGranted);
  });

  it('Test 2.9 — HCM FAILURE COMPENSATION', async () => {
    await configureHcm({ forceError: true });
    
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });
    
    // When HCM fails, the service might return 201 with FAILED_HCM_VALIDATION, or might throw 500/400.
    // We expect the entity's status to be FAILED_HCM_VALIDATION and balance to be restored to 10.
    const [requestRow] = await dataSource.query(`SELECT status FROM time_off_request WHERE employeeId = 'emp-1'`);
    expect(requestRow.status).toBe('FAILED_HCM_VALIDATION');
    
    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10);
  }, 10000);

  it('Test 2.10 — HCM TIMEOUT', async () => {
    await configureHcm({ forceDelay: 6000 });
    
    await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });
    
    const [requestRow] = await dataSource.query(`SELECT status FROM time_off_request WHERE employeeId = 'emp-1'`);
    expect(requestRow.status).toBe('FAILED_HCM_VALIDATION');

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10);
  }, 25000);

  it('Test 2.11 — SILENT HCM SUCCESS', async () => {
    await configureHcm({ silentSuccess: true });
    
    const res = await postRequest({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    const hcmRes = await request(httpServer).get('/mock-hcm/balance/emp-1/loc-a');
    expect(hcmRes.body.availableDays).toBe(10); // Mock HCM wasn't deducted in silent success
  });
});
