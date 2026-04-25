import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';
import { resetDb, resetHcm, seedBalance, configureHcm } from '../../test/helpers/seed.helper';
import { app, httpServer } from '../../test/setup';

describe('Group 4: Batch Sync (sync.service.spec.ts — Integration)', () => {
  const secret = process.env.HCM_SECRET || 'test-secret';

  beforeAll(() => {
    process.env.HCM_SECRET = secret;
  });

  beforeEach(async () => {
    await resetDb();
    await resetHcm();
  });

  const postBatch = (records: any[]) => {
    return request(httpServer)
      .post('/sync/batch')
      .set('x-hcm-secret', secret)
      .send({ records });
  };

  it('Test 4.1: processBatch updates local balance, sets lastSyncedAt, logs SUCCESS', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 8);

    const res = await postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 }]);
    expect(res.status).toBe(201);

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(15);
    expect(balanceRes.body.lastSyncedAt).not.toBeNull();

    const logsRes = await request(httpServer).get('/sync/logs');
    const latestLog = logsRes.body[0];
    expect(latestLog.source).toBe('BATCH');
    expect(latestLog.status).toBe('SUCCESS');
    expect(latestLog.recordsProcessed).toBe(1);
  });

  it('Test 4.2: IN-FLIGHT PROTECTION - balance not overwritten if pending request exists', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true }); // Prevent failure on create

    await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });

    const balancePreSync = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balancePreSync.body.availableDays).toBe(7);

    await postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 20 }]);

    const balancePostSync = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balancePostSync.body.availableDays).toBe(7); // NOT overwritten

    const logsRes = await request(httpServer).get('/sync/logs');
    const deferredLog = logsRes.body.find((l: any) => l.source === 'BATCH' && l.errors && l.errors[0]?.deferred === true);
    expect(deferredLog).toBeDefined();
    expect(deferredLog.errors[0].hcmDays).toBe(20);
  });

  it('Test 4.3: DEFERRED APPLY - processes deferred balance after approval', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true });
    
    const reqRes = await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });
    const requestId = reqRes.body.id;

    await postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 20 }]);

    // Approve the pending request
    await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });

    // Balance should now be HCM value (20) - deductions (3) = 17
    const balancePostApprove = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balancePostApprove.body.availableDays).toBe(17);
  });

  it('Test 4.4: Concurrent batch syncs -> final balance from last committed', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 5);

    await Promise.allSettled([
      postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 10 }]),
      postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 12 }]),
    ]);

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect([10, 12]).toContain(balanceRes.body.availableDays);
    expect(balanceRes.body.availableDays).toBeGreaterThanOrEqual(0);
  });

  it('Test 4.5: batch with unknown combo -> new row inserted (upsert)', async () => {
    const res = await postBatch([{ employeeId: 'emp-new', locationId: 'loc-new', leaveType: 'sick', availableDays: 5 }]);
    expect(res.status).toBe(201);

    const balanceRes = await request(httpServer).get('/balances/emp-new/loc-new');
    expect(balanceRes.body.availableDays).toBe(5);
  });

  it('Test 4.6: malformed batch payload -> 400, no partial writes', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);

    const res = await postBatch([{ employeeId: 'emp-1', locationId: 'loc-a' }]); // Missing leaveType, availableDays
    expect(res.status).toBe(400);

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10); // Unchanged
  });

  it('Test 4.7: batch with 200 records -> all processed', async () => {
    const records = Array.from({ length: 200 }).map((_, i) => ({
      employeeId: `emp-${i}`,
      locationId: 'loc-a',
      leaveType: 'annual',
      availableDays: 10,
    }));

    const res = await postBatch(records);
    expect(res.status).toBe(201);

    const logsRes = await request(httpServer).get('/sync/logs');
    const latestLog = logsRes.body[0];
    expect(latestLog.source).toBe('BATCH');
    expect(latestLog.recordsProcessed).toBe(200);
  });

  it('Test 4.8: wrong x-hcm-secret -> 401 Unauthorized', async () => {
    const res = await request(httpServer)
      .post('/sync/batch')
      .set('x-hcm-secret', 'wrong-secret-value')
      .send({
        records: [{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 10 }],
      });
    expect(res.status).toBe(401);
  });

  it('Test 4.9: DEFERRED APPLY WITH MULTIPLE PENDING REQUESTS', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 20);
    await configureHcm({ silentSuccess: true });

    // Create first pending request (3 days) → balance = 17
    const req1 = await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 3, startDate: '2025-01-01', endDate: '2025-01-03' });
    expect(req1.status).toBe(201);
    const requestId1 = req1.body.id;

    // Create second pending request (5 days) → balance = 12
    const req2 = await request(httpServer)
      .post('/requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', daysRequested: 5, startDate: '2025-02-01', endDate: '2025-02-05' });
    expect(req2.status).toBe(201);

    let balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(12);

    // Batch sync with HCM value 30 → deferred (pending requests exist)
    await postBatch([{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 30 }]);

    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(12); // NOT overwritten

    // Approve first request → applyDeferredSync fires
    await request(httpServer)
      .patch(`/requests/${requestId1}/approve`)
      .send({ managerId: 'mgr-1' });

    // effective = HCM(30) - pending(3 approved after sync trigger) - pending(5 still pending) = 22
    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(22);
  });
});
