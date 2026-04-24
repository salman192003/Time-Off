# Developer Handover Document: Time-Off Microservice

## 1. System Architecture & Problem Solving

### Source of Truth Relationship
This microservice operates as an optimistic local cache providing high-availability frontend resolution. The external Human Capital Management (HCM) system (ExampleHR) is strictly treated as the ultimate source of truth. The microservice processes user time-off requests locally for instant feedback and relies on background workers to achieve eventual consistency with the HCM.

### The Dual-Integer Strategy
To safely manage local assumptions against asynchronous upstream truths, records employ a dual-integer strategy:
*   **`availableDays`**: The absolute balance broadcasted by the HCM.
*   **`pendingDays`**: An optimistic counter tracking locally submitted, unconfirmed time-off requests. 
*   **Logical Constraint**: A request is only permitted if `availableDays - pendingDays >= requestedDays`.

### Compound Isolation
Balances are strictly tracked and vertically isolated per business requirement using a unique compound index: `@Index(['employeeId', 'locationId'], { unique: true })`. Every database transaction (creation, sync, or batch job) explicitly scopes `WHERE` clauses against both keys, mathematically guaranteeing no cross-location balance bleeds limit an employee's time off.

### Concurrency Safety (Preventing Double-Spends)
To handle race conditions (e.g., rapid double-clicks) where concurrent requests attempt to draw from the exact same balance millisecond, the `BalanceRecord` entity leverages TypeORM's `@VersionColumn()`. When `TimeoffService` approves a local booking, it uses isolated `QueryRunner` database transactions to increment `pendingDays` and bump the version. Overlapping transactions reading the stale version fail to execute the `UPDATE` statement, natively throwing a `409 ConflictException` and thwarting the double-spend.

## 2. Module Interconnections

### TimeOffModule
Manages the synchronous lifecycle of time-off requests. It handles REST payloads, calculates the local `effectiveBalance`, and explicitly increments the local `pendingDays` reservation state within an isolated transactional boundary before committing a `PENDING` request to the database.

### SyncModule
Normalizes HCM datasets and applies them locally. The `processBatchSync` handles the "whole corpus" batch endpoint from the HCM. It safely overwrites `availableDays` locally, ignoring the request backlog, and executes the mathematical conflict resolution algorithm if the external data drifts beneath the reserved thresholds.

### SchedulerModule
Orchestrates background asynchronous execution using `@nestjs/schedule`:
*   **Batch Polling (5-Min)**: Triggers `runBatchReconciliation()` to ingest the full corpus dataset from the HCM to correct un-notified balance drifts.
*   **Retry Worker (1-Min)**: Triggers `retryPendingRequests()`. It sweeps the database for failed or un-synced `PENDING` requests and dispatches them to the HCM sequentially. It gracefully handles 400 (Insufficient Balance) exceptions by releasing local constraints, and suppresses transient 500 Network errors to safely retry later without database corruption.

### MockHcmModule
A localized testing utility simulating the external ExampleHR HCM system to validate distributed workflows. It natively injects **Chaos Engineering**, enforcing a 10% chance to randomly throw a `500 InternalServerErrorException` during submission, forcing the `SchedulerModule` to prove its resilience.

## 3. Defending Against HCM Divergence

### Independent HCM Changes
The external HCM balance can change independently (e.g., an automated "work anniversary" granting extra days, or an HR admin deducting hours out-of-band). Upon webhook invocation or cron-job polling, the `SyncModule` forces the local `availableDays` to mutate, aligning to the exact integer provided by the HCM.

### Conflict Resolution Algorithm
When a batch sync is applied, it may reveal that a local `PENDING` request no longer has structural backing (i.e., `availableDays - pendingDays < 0`). The `SyncModule` automatically executes a reconciliation loop:
1. Queries all isolated `PENDING` requests, ordering strictly chronologically (`ASC`).
2. Iteratively mutates the oldest incompatible `PENDING` request into `REJECTED`.
3. Decrements the `pendingDays` allocation, repeating until `availableDays - pendingDays >= 0` is restored.
4. Bulk saves the corrected requests and resolved `BalanceRecord`, committing the transaction.

## 4. Testing Rigor & Regression Defense

### Why End-to-End (e2e) Testing?
Unlike unit tests, End-to-End (e2e) testing validates the entire request lifecycle, testing exact database `QueryRunner` boundaries, transaction propagation, and background scheduler effects across interconnected modules. It proves eventual consistency flows mechanically exactly as they will in a production deployment.

### Specific Failure Modes Tested
The e2e suite (`test/timeoff.e2e-spec.ts`) actively asserts:
*   **Defensive Boundary Rejections**: Proves the local `TimeoffModule` immediately rejects payload days exceeding the local cache.
*   **Idempotency & 500 Recovery**: Validates that simulating an upstream crash preserves the local request securely in a `PENDING` state holding the cache boundary.
*   **Optimistic Locking Collisions**: Parallels `Promise.all()` HTTP requests to trigger `SQLITE_ERROR: cannot start a transaction within a transaction`, assuring overlapping execution is strictly blocked natively at the row-level.
*   **Conflict Resolution**: Simulates a silent HCM balance drop, successfully triggering the daemon to auto-reject un-backed reservations.

## 5. Setup & Execution

From the `time-off-service` directory, execute the following standard NestJS commands:

**Install Dependencies:**
```bash
npm install
```

**Run Development Server:**
*The server utilizes SQLite natively; passing `synchronize: true` provisions the local schemas on boot.*
```bash
npm run start:dev
```

**Execute the E2E Test Suite:**
```bash
npm run test:e2e
```
