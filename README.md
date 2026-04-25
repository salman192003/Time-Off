# Time-Off

A microservice built with NestJS to manage employee time-off requests and keep local balances strictly synchronized with an external Human Capital Management (HCM) system.

## Architecture Overview

The system maintains a local operational copy of employee time-off balances to provide high availability and fast responses, but treats the external HCM as the ultimate source of truth. When an employee requests time off, the system immediately reserves the local time using optimistic locking and triggers a distributed transaction to debit the HCM system. If the HCM validation fails or times out, the system executes a compensating transaction to credit the local balance back, ensuring consistency.

Because the system allows for manual approvals, rejections, and cancellations which can overlap with scheduled batch synchronizations or real-time HCM updates, a deferred sync pattern is heavily utilized. If a sync event arrives while an employee has pending requests, the authoritative HCM balance is not immediately overwritten in a way that would destroy the pending state; instead, the sync is deferred to a log and resolved cleanly using a reconciliation formula once the inflight requests conclude.

## Key Design Decisions

| Decision | Why | Trade-off |
|----------|-----|-----------|
| Optimistic locking via version column | Prevents overdrafts when multiple concurrent requests attempt to debit the same remaining balance. | Requires manual retry logic or explicit failure handling if transactions conflict. |
| Deferred sync for in-flight requests | Prevents HCM syncs from wiping out the reserved state of pending requests not yet known to the HCM. | Adds complexity to sync resolution and requires keeping state of pending requests over time. |
| Compensating transaction on HCM failure | Ensures local and remote systems remain strongly consistent when the external HCM is down or rejects a debit. | Increased latency on failure paths; requires precise rollback execution logic. |
| Resolution formula (HCM value - pending days) | Correctly calculates the true effective balance by acknowledging that pending local requests represent days not yet deducted in HCM. | Requires dynamic queries to sum all pending requests relative to the exact moment the sync fired. |

## Quick Start

```
cp .env.example .env
npm install
npm run start
```
App runs on port 3000

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | The internal port the server listens on | `3000` |
| HCM_SECRET | The secret key required by batch/realtime sync endpoints | (none) |
| HCM_BASE_URL | The root URL for the external HCM API client | `http://localhost:3000` |

## API Reference

### Balances
| Method | Path | Auth Required | Description | Request Body |
|--------|------|---------------|-------------|--------------|
| GET | `/balances/:employeeId` | No | Retrieve all leave balances for a specific employee. | |
| GET | `/balances/:employeeId/:locationId` | No | Retrieve a specific leave balance filtered by location. | |

### Requests
| Method | Path | Auth Required | Description | Request Body |
|--------|------|---------------|-------------|--------------|
| POST | `/requests` | No | Create a new time-off request and reserve the balance. | `employeeId, locationId, leaveType, daysRequested, startDate, endDate` |
| GET | `/requests/:id` | No | Retrieve a specific time-off request by ID. | |
| GET | `/requests` | No | Retrieve multiple requests, optionally filtered by `employeeId` or `status`. | |
| PATCH | `/requests/:id/approve` | No | Approve a pending request. | `managerId` |
| PATCH | `/requests/:id/reject` | No | Reject a pending request and restore balance. | `managerId` |
| DELETE | `/requests/:id` | No | Cancel an existing request and restore balance. | `employeeId` |

### Sync
| Method | Path | Auth Required | Description | Request Body |
|--------|------|---------------|-------------|--------------|
| POST | `/sync/batch` | YES | Process a bulk update of authoritative balances from the HCM. | `records` |
| POST | `/sync/realtime` | YES | Process an immediate update for a single employee's balance. | `employeeId, locationId, leaveType, availableDays` |
| GET | `/sync/logs` | No | Retrieve the history of all synchronization events and errors. | |

## Mock HCM Server

The application includes an internal mock controller designed specifically for simulating an external HCM provider to test resilience logic without third-party dependencies.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mock-hcm/balance/:employeeId/:locationId` | Retrieves a specific balance for from the mock store. |
| GET | `/mock-hcm/batch` | Retrieves all current balances from the mock store representing a nightly export. |
| POST | `/mock-hcm/balance` | Directly upserts a balance payload into the mock store. |
| POST | `/mock-hcm/apply-debit` | Attempts to debit a specific amount from the mock store; strictly enforces sufficient funds. |
| POST | `/mock-hcm/config` | Modifies the behavior of the mock to simulate network scenarios. |
| POST | `/mock-hcm/reset` | Clears all data and restores the default configuration. |
| POST | `/mock-hcm/seed` | Loads bulk predefined records directly into the mock store. |

### Config Flags (POST /mock-hcm/config)

| Flag | Type | Effect |
|------|------|--------|
| `forceError` | boolean | Simulates total system outage by immediately throwing HTTP 500 Internal Server Error on every request. |
| `forceDelay` | number | Simulates extreme network latency by artificially pausing responses by the specified number of milliseconds. |
| `silentSuccess`| boolean | Simulates a successful `apply-debit` request returning 200 OK without actually reducing the numerical balance in the mock store. |

## Running Tests

```bash
npm run test          # Runs all unit, integration, and e2e test suites
```
SQLite handles file-based locks poorly under parallel connections, so running with `--runInBand` is strictly required to execute the intensive database test suites sequentially and avoid `database is locked` corruption errors.

## Project Structure

```
src/
├── balance/
├── common/
├── hcm/
├── request/
└── sync/
```

- **balance**: Manages local physical records of employee leave balances and handles optimistic concurrency locking operations.
- **common**: Contains cross-cutting architectural definitions and standardized domain exceptions like `InsufficientBalanceException`.
- **hcm**: Implements the HTTP resilient integration client for interacting with the external human capital platform API.
- **request**: Orchestrates the entire lifecycle and transactional distributed logic for creating, approving, and canceling time-off instances.
- **sync**: Processes external updates from the HCM and correctly aligns in-flight local requests using deferred reconciliation formulas.
