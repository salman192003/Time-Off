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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const rxjs_1 = require("rxjs");
const sync_service_1 = require("../sync/sync.service");
const time_off_request_entity_1 = require("../entities/time-off-request.entity");
const balance_record_entity_1 = require("../entities/balance-record.entity");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    httpService;
    syncService;
    dataSource;
    requestRepository;
    balanceRepository;
    logger = new common_1.Logger(SchedulerService_1.name);
    constructor(httpService, syncService, dataSource, requestRepository, balanceRepository) {
        this.httpService = httpService;
        this.syncService = syncService;
        this.dataSource = dataSource;
        this.requestRepository = requestRepository;
        this.balanceRepository = balanceRepository;
    }
    async runBatchReconciliation() {
        this.logger.log('Starting Batch Reconciliation process...');
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get('http://localhost:3000/mock-hcm/batch'));
            const result = await this.syncService.processBatchSync(response.data);
            this.logger.log(`Batch Reconciliation complete. Updated: ${result.updated}, Auto-Rejected: ${result.rejected}`);
        }
        catch (error) {
            this.logger.error(`Batch Reconciliation failed: ${error.message}`);
        }
    }
    async retryPendingRequests() {
        this.logger.log('Scanning for pending requests to process/retry...');
        const pendingRequests = await this.requestRepository.find({
            where: { status: time_off_request_entity_1.RequestStatus.PENDING }
        });
        if (pendingRequests.length === 0) {
            this.logger.debug('No pending requests found.');
            return;
        }
        this.logger.log(`Found ${pendingRequests.length} pending requests. Processing...`);
        for (const request of pendingRequests) {
            try {
                const payload = {
                    employeeId: request.employeeId,
                    locationId: request.locationId,
                    days: request.days,
                    requestId: request.id,
                };
                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post('http://localhost:3000/mock-hcm/submit', payload));
                if (response.data.success) {
                    request.status = time_off_request_entity_1.RequestStatus.APPROVED;
                    request.hcmSubmittedAt = new Date();
                    request.hcmError = null;
                    await this.requestRepository.save(request);
                    this.logger.log(`Request ${request.id} automatically APPROVED in HCM.`);
                }
            }
            catch (error) {
                const status = error.response?.status;
                if (status === 400) {
                    await this.dataSource.transaction(async (manager) => {
                        request.status = time_off_request_entity_1.RequestStatus.REJECTED;
                        request.hcmError = error.response?.data?.message || 'Insufficient balance';
                        await manager.save(time_off_request_entity_1.TimeOffRequest, request);
                        const balance = await manager.findOne(balance_record_entity_1.BalanceRecord, {
                            where: { employeeId: request.employeeId, locationId: request.locationId }
                        });
                        if (balance) {
                            await manager.update(balance_record_entity_1.BalanceRecord, { id: balance.id, version: balance.version }, { pendingDays: balance.pendingDays - request.days, version: balance.version + 1 });
                        }
                    });
                    this.logger.warn(`Request ${request.id} REJECTED due to 400 from HCM. Reservation released.`);
                }
                else {
                    request.hcmError = error.message || 'Transient HCM error';
                    await this.requestRepository.save(request);
                    this.logger.error(`Request ${request.id} transient failure (Status: ${status}). Will retry later.`);
                }
            }
        }
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "runBatchReconciliation", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "retryPendingRequests", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(time_off_request_entity_1.TimeOffRequest)),
    __param(4, (0, typeorm_1.InjectRepository)(balance_record_entity_1.BalanceRecord)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        sync_service_1.SyncService,
        typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map