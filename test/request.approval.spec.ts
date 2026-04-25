import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { resetDb, resetHcm, seedBalance, seedHcmBalance } from './helpers/seed.helper';
import { app, httpServer } from './setup';

describe('Group 3: Approval Workflow (request.service.spec.ts)', () => {
  let requestId: string;
  const secret = process.env.HCM_SECRET || 'test-secret';

  beforeAll(() => {
    process.env.HCM_SECRET = secret;
  });
  beforeEach(async () => {
    await resetDb();
    await resetHcm();
    await seedBalance('emp-1', 'loc-a', 'annual', 10);
    await seedHcmBalance('emp-1', 'loc-a', 'annual', 10);

    // Create a PENDING request for 3 days
    const res = await request(httpServer)
      .post('/requests')
      .send({
        employeeId: 'emp-1',
        locationId: 'loc-a',
        leaveType: 'annual',
        daysRequested: 3,
        startDate: '2025-01-01',
        endDate: '2025-01-03',
      });
    
    requestId = res.body.id;
  });

  it('Test 3.1: approve(requestId, "mgr-1") -> status APPROVED, balance stays at 7', async () => {
    const res = await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });
      
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);
  });

  it('Test 3.2: reject(requestId, "mgr-1") -> status REJECTED, balance returns to 10', async () => {
    const res = await request(httpServer)
      .patch(`/requests/${requestId}/reject`)
      .send({ managerId: 'mgr-1' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10);
  });

  it('Test 3.3: approve already APPROVED request -> throws ConflictException (409)', async () => {
    await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });

    const res2 = await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-2' });

    expect(res2.status).toBe(409);
  });

  it('Test 3.4: cancel an APPROVED request -> throws ConflictException (409)', async () => {
    await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'mgr-1' });

    const cancelRes = await request(httpServer)
      .delete(`/requests/${requestId}`)
      .send({ employeeId: 'emp-1' });

    expect(cancelRes.status).toBe(409);
  });

  it('Test 3.5: employee cancels own PENDING request -> status CANCELLED, balance = 10', async () => {
    const cancelRes = await request(httpServer)
      .delete(`/requests/${requestId}`)
      .send({ employeeId: 'emp-1' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(10);
  });

  it('Test 3.6: different employee calls approve endpoint (manager rules check) -> 403', async () => {
    const res = await request(httpServer)
      .patch(`/requests/${requestId}/approve`)
      .send({ managerId: 'emp-1' });

    expect(res.status).toBe(403);
  });

  it('Test 3.7: approve non-existent ID -> 404', async () => {
    const res = await request(httpServer)
      .patch('/requests/b2ab99f4-18c7-43ca-aae8-fcab7f54c9c1/approve')
      .send({ managerId: 'mgr-1' });

    expect(res.status).toBe(404);
  });

  it('Test 3.8: REJECT WITH DEFERRED SYNC — balance becomes HCM value (no pending left)', async () => {
    // State: balance=7 (seeded 10 - 3 from beforeEach request), pending request exists

    // Trigger a batch sync with HCM value 20 → should defer because pending request exists
    await request(httpServer)
      .post('/sync/batch')
      .set('x-hcm-secret', secret)
      .send({
        records: [{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 20 }],
      });

    // Balance should still be 7 (deferred, not overwritten)
    let balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // Reject the pending request → should restore balance AND apply deferred sync
    const rejRes = await request(httpServer)
      .patch(`/requests/${requestId}/reject`)
      .send({ managerId: 'mgr-1' });
    expect(rejRes.status).toBe(200);
    expect(rejRes.body.status).toBe('REJECTED');

    // After rejection: no pending requests remain, so deferred sync should set balance to HCM value (20)
    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(20);
  });

  it('Test 3.9: CANCEL WITH DEFERRED SYNC — balance becomes HCM value (no pending left)', async () => {
    // State: balance=7, pending request exists from beforeEach

    // Trigger a batch sync with HCM value 25 → deferred
    await request(httpServer)
      .post('/sync/batch')
      .set('x-hcm-secret', secret)
      .send({
        records: [{ employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 25 }],
      });

    let balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(7);

    // Cancel by employee → should restore balance AND apply deferred sync
    const cancelRes = await request(httpServer)
      .delete(`/requests/${requestId}`)
      .send({ employeeId: 'emp-1' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');

    // No pending requests remain → deferred sync should set balance to HCM value (25)
    balanceRes = await request(httpServer).get('/balances/emp-1/loc-a');
    expect(balanceRes.body.availableDays).toBe(25);
  });
});
