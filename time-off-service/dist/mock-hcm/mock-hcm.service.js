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
var MockHcmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockHcmService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let MockHcmService = MockHcmService_1 = class MockHcmService {
    httpService;
    logger = new common_1.Logger(MockHcmService_1.name);
    balances = [
        { employeeId: 'emp-1', locationId: 'loc-A', balance: 15 },
        { employeeId: 'emp-2', locationId: 'loc-A', balance: 20 },
        { employeeId: 'emp-3', locationId: 'loc-B', balance: 10 },
    ];
    processedRequests = new Set();
    constructor(httpService) {
        this.httpService = httpService;
    }
    submitTimeOff(employeeId, locationId, days, requestId) {
        if (this.processedRequests.has(requestId)) {
            this.logger.log(`Request ${requestId} already processed. Returning success idempotently.`);
            return { success: true, message: 'Request already processed' };
        }
        if (Math.random() < 0.1) {
            this.logger.warn(`Simulated HCM transient downtime for request ${requestId}`);
            throw new common_1.InternalServerErrorException('Simulated transient HCM error');
        }
        const employee = this.balances.find(b => b.employeeId === employeeId && b.locationId === locationId);
        if (!employee) {
            throw new common_1.BadRequestException('Employee not found in HCM');
        }
        if (days > employee.balance) {
            throw new common_1.BadRequestException('Insufficient balance in HCM');
        }
        employee.balance -= days;
        this.processedRequests.add(requestId);
        this.logger.log(`Successfully processed time off for ${employeeId}. New balance: ${employee.balance}`);
        return { success: true, balance: employee.balance };
    }
    getBatchBalances() {
        return {
            records: this.balances.map(b => ({
                employeeId: b.employeeId,
                locationId: b.locationId,
                availableDays: b.balance,
            })),
        };
    }
    async triggerWorkAnniversary(employeeId, locationId, extraDays) {
        const employee = this.balances.find(b => b.employeeId === employeeId && b.locationId === locationId);
        if (!employee) {
            throw new common_1.BadRequestException('Employee not found in HCM');
        }
        employee.balance += extraDays;
        this.logger.log(`Triggered work anniversary for ${employeeId}. Added ${extraDays} days. New balance: ${employee.balance}`);
        const payload = {
            employeeId: employee.employeeId,
            locationId: employee.locationId,
            availableDays: employee.balance,
        };
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService.post('http://localhost:3000/sync/webhook', payload));
            this.logger.log(`Successfully sent webhook update to ExampleHR for ${employeeId}`);
            return { success: true, newBalance: employee.balance, webhookSent: true };
        }
        catch (error) {
            this.logger.error(`Failed to send webhook to ExampleHR: ${error.message}`);
            return {
                success: true,
                newBalance: employee.balance,
                webhookSent: false,
                error: error.message
            };
        }
    }
};
exports.MockHcmService = MockHcmService;
exports.MockHcmService = MockHcmService = MockHcmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], MockHcmService);
//# sourceMappingURL=mock-hcm.service.js.map