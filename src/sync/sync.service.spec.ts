import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';
import { resetDb, resetHcm, seedBalance, configureHcm } from '../../test/helpers/seed.helper';
import { app, httpServer } from '../../test/setup';

describe('Group 5: Real-Time Sync (sync.service.spec.ts — Integration)', () => {
  const secret = process.env.HCM_SECRET || 'test-secret';

  beforeAll(() => {
    process.env.HCM_SECRET = secret;
  });

  beforeEach(async () => {
    await resetDb();
    await resetHcm();
  });

  const postRealtime = (body: any) => {
    return request(httpServer)
      .post('/sync/realtime')
      .set('x-hcm-secret', secret)
      .send(body);
  };

  it('Test 5.1: POST /sync/realtime No pending requests -> balance updated immediately', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 8);

    const res = await postRealtime({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 });
    expect(res.status).toBe(201);

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(15);
  });

  it('Test 5.2: Same but with PENDING request in flight -> balance not overwritten, deferred to sync_log', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true });

    await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });

    const balancePreSync = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balancePreSync.body.availableDays).toBe(7);

    const res = await postRealtime({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 });
    expect(res.status).toBe(201);

    const balancePostSync = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balancePostSync.body.availableDays).toBe(7); // NOT overwritten

    const logsRes = await request(httpServer).get('/sync/logs');
    const deferredLog = logsRes.body.find((l: any) => l.source === 'REALTIME' && l.errors && l.errors.deferred === true);
    expect(deferredLog).toBeDefined();
  });

  it('Test 5.3: Realtime sync where hcmDays = 1 but pending request = 3 days -> conflict', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true });

    await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });

    // Pending deduction is 3
    const res = await postRealtime({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 1 });
    expect(res.status).toBe(201); // no exception thrown

    const logsRes = await request(httpServer).get('/sync/logs');
    const conflictLog = logsRes.body.find((l: any) => l.source === 'REALTIME' && l.errors && l.errors.manualReviewRequired === true);
    expect(conflictLog).toBeDefined();
    expect(conflictLog.status).toBe('FAILURE');
  });

  it('Test 5.4: missing locationId in body -> 400', async () => {
    const res = await postRealtime({ employeeId: 'emp-1', leaveType: 'annual', availableDays: 15 });
    expect(res.status).toBe(400);
  });

  it('Test 5.5: missing x-hcm-secret header -> 401 Unauthorized', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 8);

    const res = await request(httpServer)
      .post('/sync/realtime')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 });
    expect(res.status).toBe(401);
  });

  it('Test 5.6: wrong x-hcm-secret header -> 401 Unauthorized', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 8);

    const res = await request(httpServer)
      .post('/sync/realtime')
      .set('x-hcm-secret', 'wrong-secret-value')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 });
    expect(res.status).toBe(401);
  });
});
