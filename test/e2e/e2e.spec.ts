import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import request from 'supertest';
import { resetDb, resetHcm, seedBalance, seedHcmBalance, configureHcm } from '../helpers/seed.helper';
import { app, httpServer } from '../setup';

describe('Group 9: End-to-End Flows (e2e.spec.ts — Integration)', () => {
  const secret = process.env.HCM_SECRET || 'test-secret';

  beforeAll(() => {
    process.env.HCM_SECRET = secret;
  });

  beforeEach(async () => {
    await resetDb();
    await resetHcm();
  });

  it('Test 9.1: FULL HAPPY PATH', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    
    // POST /mock-hcm/seed [{ emp-1, loc-a, annual, 10 }]
    await request(httpServer)
      .post('/mock-hcm/seed')
      .send({
        records: [{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 10 }],
      });

    // POST /requests { emp-1, loc-a, annual, 3 days } -> 201, status=PENDING
    const reqRes = await request(httpServer)
      .post('/requests')
      .send({
        employeeId: 'emp-1',
        locationId: 'loc-a',
        leaveType: 'annual',
        daysRequested: 3,
        startDate: '2026-05-01',
        endDate: '2026-05-03',
      });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.status).toBe('PENDING');
    const requestId = reqRes.body.id;

    // GET /balances/emp-1 -> availableDays = 7
    let balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // PATCH /requests/:id/approve { managerId: 'mgr-1' } -> 200, status=APPROVED
    const appRes = await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });
    expect(appRes.status).toBe(200);
    expect(appRes.body.status).toBe('APPROVED');

    // GET /balances/emp-1 -> availableDays = 7 (unchanged by approval)
    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // GET /mock-hcm/balance/emp-1/loc-a -> verify HCM was debited to 7
    const hcmRes = await request(httpServer).get('/mock-hcm/balance/emp-1/loc-a');
    expect(hcmRes.status).toBe(200);
    expect(hcmRes.body.availableDays).toBe(7);
  });

  it('Test 9.2: ANNIVERSARY REFRESH FLOW', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await seedHcmBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true });

    // POST /sync/realtime
    const syncRes = await request(httpServer)
      .post('/sync/realtime')
      .set('x-hcm-secret', secret)
      .send({ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 15 });
    expect(syncRes.status).toBe(201);

    // GET /balances/emp-1/loc-a -> availableDays = 15
    const balanceRes1 = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes1.body.availableDays).toBe(15);

    // POST /requests { emp-1, loc-a, annual, 12 days } -> 201 PENDING
    const reqRes = await request(httpServer)
      .post('/requests')
      .send({
        employeeId: 'emp-1',
        locationId: 'loc-a',
        leaveType: 'annual',
        daysRequested: 12,
        startDate: '2026-05-01',
        endDate: '2026-05-12',
      });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.status).toBe('PENDING');

    // GET /balances/emp-1/loc-a -> availableDays = 3
    const balanceRes2 = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes2.body.availableDays).toBe(3);
  });

  it('Test 9.3: DEFERRED SYNC + APPROVAL', async () => {
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await seedHcmBalance('emp-1', 'loc-a', 'annual', 10);
    await configureHcm({ silentSuccess: true });

    // POST /requests (3 days)
    const reqRes = await request(httpServer)
      .post('/requests')
      .send({
        employeeId: 'emp-1',
        locationId: 'loc-a',
        leaveType: 'annual',
        daysRequested: 3,
        startDate: '2026-05-01',
        endDate: '2026-05-03',
      });
    expect(reqRes.status).toBe(201);
    const requestId = reqRes.body.id;

    // balance = 7
    let balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // POST /sync/batch [{ emp-1, loc-a, annual, 20 }] -> balance stays 7, deferred
    const syncRes = await request(httpServer)
      .post('/sync/batch')
      .set('x-hcm-secret', secret)
      .send({
        records: [{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 20 }],
      });
    expect(syncRes.status).toBe(201);

    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // PATCH /requests/:id/approve -> applyDeferredSync fires
    const appRes = await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });
    expect(appRes.status).toBe(200);

    // GET /balances/emp-1/loc-a -> availableDays = 17 (20 - 3)
    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(17);
  });
});
