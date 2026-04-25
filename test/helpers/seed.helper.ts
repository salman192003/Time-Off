import { Repository, DataSource } from 'typeorm';
import request from 'supertest';
import { Balance } from '../../src/balance/balance.entity';
import { TimeOffRequest } from '../../src/request/request.entity';
import { app, httpServer } from '../setup';
import { getRepositoryToken } from '@nestjs/typeorm';

export async function seedBalance(
  repoOrEmp: Repository<Balance> | string,
  employeeIdOrLoc: string,
  locationIdOrLeave: string,
  leaveTypeOrDays: string | number,
  days?: number,
) {
  let repo: Repository<Balance>;
  let emp, loc, leave, d;

  if (typeof repoOrEmp === 'string') {
    repo = app.get(getRepositoryToken(Balance));
    emp = repoOrEmp;
    loc = employeeIdOrLoc;
    leave = locationIdOrLeave;
    d = leaveTypeOrDays as number;
  } else {
    repo = repoOrEmp;
    emp = employeeIdOrLoc;
    loc = locationIdOrLeave;
    leave = leaveTypeOrDays as string;
    d = days as number;
  }

  const balance = repo.create({
    employeeId: emp,
    locationId: loc,
    leaveType: leave,
    availableDays: d,
  });
  return await repo.save(balance);
}

export async function seedRequest(
  repo: Repository<TimeOffRequest>,
  overrides: Partial<TimeOffRequest>,
) {
  const defaults = {
    employeeId: 'emp-default',
    locationId: 'loc-default',
    leaveType: 'annual',
    daysRequested: 1,
    startDate: '2025-01-01',
    endDate: '2025-01-01',
    status: 'PENDING',
  };
  const req = repo.create({ ...defaults, ...overrides } as any);
  return await repo.save(req);
}

export async function seedHcmBalance(
  httpServerOrEmp: any,
  employeeIdOrLoc: string,
  locationIdOrLeave: string,
  leaveTypeOrDays: string | number,
  days?: number,
) {
  let server;
  let emp, loc, leave, d;

  if (typeof httpServerOrEmp === 'string') {
    server = httpServer;
    emp = httpServerOrEmp;
    loc = employeeIdOrLoc;
    leave = locationIdOrLeave;
    d = leaveTypeOrDays as number;
  } else {
    server = httpServerOrEmp;
    emp = employeeIdOrLoc;
    loc = locationIdOrLeave;
    leave = leaveTypeOrDays as string;
    d = days as number;
  }

  const payload = {
    records: [
      {
        employeeId: emp,
        locationId: loc,
        leaveType: leave,
        availableDays: d,
      },
    ],
  };
  await request(server).post('/mock-hcm/seed').send(payload);
}

export async function resetHcm(server?: any) {
  await request(server || httpServer).post('/mock-hcm/reset').send();
}

export async function configureHcm(config: any) {
  await request(httpServer).post('/mock-hcm/config').send(config);
}

export async function resetDb(ds?: DataSource) {
  const dataSource = ds || app.get(DataSource);
  await dataSource.query('DELETE FROM time_off_request;');
  await dataSource.query('DELETE FROM balance;');
  await dataSource.query('DELETE FROM sync_log;');
}
