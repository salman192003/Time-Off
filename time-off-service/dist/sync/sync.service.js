"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const balance_record_entity_1 = require("../entities/balance-record.entity");
const time_off_request_entity_1 = require("../entities/time-off-request.entity");
const sync_log_entity_1 = require("../entities/sync-log.entity");
let SyncService = class SyncService {
    dataSource;
    balanceRepository;
    requestRepository;
    syncLogRepository;
    constructor(dataSource, balanceRepository, requestRepository, syncLogRepository) {
        this.dataSource = dataSource;
        this.balanceRepository = balanceRepository;
        this.requestRepository = requestRepository;
        this.syncLogRepository = syncLogRepository;
    }
    async reconcileEmployeeBalance(manager, employeeId, locationId, availableDays) {
        let balance = await manager.findOne(balance_record_entity_1.BalanceRecord, {
            where: { employeeId, locationId },
        });
        if (!balance) {
            balance = manager.create(balance_record_entity_1.BalanceRecord, {
                employeeId,
                locationId,
                availableDays,
                pendingDays: 0,
                lastSyncedAt: new Date(),
            });
        }
        else {
            balance.availableDays = availableDays;
            balance.lastSyncedAt = new Date();
        }
        await manager.save(balance_record_entity_1.BalanceRecord, balance);
        let rejectedCount = 0;
        if (balance.availableDays - balance.pendingDays < 0) {
            const pendingRequests = await manager.find(time_off_request_entity_1.TimeOffRequest, {
                where: { employeeId, locationId, status: time_off_request_entity_1.RequestStatus.PENDING },
                order: { createdAt: 'ASC' },
            });
            const requestsToUpdate = [];
            for (const request of pendingRequests) {
                if (balance.availableDays - balance.pendingDays >= 0)
                    break;
                request.status = time_off_request_entity_1.RequestStatus.REJECTED;
                balance.pendingDays -= request.days;
                requestsToUpdate.push(request);
                rejectedCount++;
            }
            if (requestsToUpdate.length > 0) {
                await manager.save(time_off_request_entity_1.TimeOffRequest, requestsToUpdate);
                await manager.save(balance_record_entity_1.BalanceRecord, balance);
            }
        }
        return { rejectedRequests: rejectedCount };
    }
    async processBatchSync(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let totalRejected = 0;
        try {
            for (const record of dto.records) {
                const { rejectedRequests } = await this.reconcileEmployeeBalance(queryRunner.manager, record.employeeId, record.locationId, record.availableDays);
                totalRejected += rejectedRequests;
            }
            const syncLog = queryRunner.manager.create(sync_log_entity_1.SyncLog, {
                type: sync_log_entity_1.SyncType.BATCH,
                triggeredBy: 'scheduler',
                affectedEmployees: dto.records.length,
                requestsRevalidated: 0,
                requestsAutoRejected: totalRejected,
                status: sync_log_entity_1.SyncStatus.SUCCESS,
            });
            await queryRunner.manager.save(sync_log_entity_1.SyncLog, syncLog);
            await queryRunner.commitTransaction();
            return { success: true, updated: dto.records.length, rejected: totalRejected };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            const syncLog = this.syncLogRepository.create({
                type: sync_log_entity_1.SyncType.BATCH,
                triggeredBy: 'scheduler',
                affectedEmployees: dto.records.length,
                requestsRevalidated: 0,
                requestsAutoRejected: 0,
                status: sync_log_entity_1.SyncStatus.FAILED,
                errorDetail: error instanceof Error ? error.message : String(error),
            });
            await this.syncLogRepository.save(syncLog);
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async processWebhook(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const { rejectedRequests } = await this.reconcileEmployeeBalance(queryRunner.manager, dto.employeeId, dto.locationId, dto.availableDays);
            const syncLog = queryRunner.manager.create(sync_log_entity_1.SyncLog, {
                type: sync_log_entity_1.SyncType.WEBHOOK,
                triggeredBy: 'hcm-webhook',
                affectedEmployees: 1,
                requestsRevalidated: 0,
                requestsAutoRejected: rejectedRequests,
                status: sync_log_entity_1.SyncStatus.SUCCESS,
            });
            await queryRunner.manager.save(sync_log_entity_1.SyncLog, syncLog);
            await queryRunner.commitTransaction();
            return { success: true, updated: 1, rejected: rejectedRequests };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            const syncLog = this.syncLogRepository.create({
                type: sync_log_entity_1.SyncType.WEBHOOK,
                triggeredBy: 'hcm-webhook',
                affectedEmployees: 1,
                requestsRevalidated: 0,
                requestsAutoRejected: 0,
                status: sync_log_entity_1.SyncStatus.FAILED,
                errorDetail: error instanceof Error ? error.message : String(error),
            });
            await this.syncLogRepository.save(syncLog);
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(balance_record_entity_1.BalanceRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(time_off_request_entity_1.TimeOffRequest)),
    __param(3, (0, typeorm_1.InjectRepository)(sync_log_entity_1.SyncLog)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SyncService);
//# sourceMappingURL=sync.service.js.map