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
exports.TimeoffService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const balance_record_entity_1 = require("../entities/balance-record.entity");
const time_off_request_entity_1 = require("../entities/time-off-request.entity");
const update_status_dto_1 = require("./dto/update-status.dto");
let TimeoffService = class TimeoffService {
    dataSource;
    balanceRepository;
    requestRepository;
    constructor(dataSource, balanceRepository, requestRepository) {
        this.dataSource = dataSource;
        this.balanceRepository = balanceRepository;
        this.requestRepository = requestRepository;
    }
    async getBalance(employeeId, locationId) {
        const record = await this.balanceRepository.findOne({
            where: { employeeId, locationId },
        });
        if (!record) {
            throw new common_1.NotFoundException('Balance record not found');
        }
        return {
            ...record,
            effectiveBalance: record.availableDays - record.pendingDays,
        };
    }
    async createRequest(dto) {
        return await this.dataSource.transaction(async (manager) => {
            const balance = await manager.findOne(balance_record_entity_1.BalanceRecord, {
                where: { employeeId: dto.employeeId, locationId: dto.locationId },
            });
            if (!balance) {
                throw new common_1.NotFoundException('Balance record not found');
            }
            const effectiveBalance = balance.availableDays - balance.pendingDays;
            if (effectiveBalance < dto.days) {
                throw new common_1.BadRequestException('Insufficient local balance');
            }
            const updateResult = await manager.update(balance_record_entity_1.BalanceRecord, {
                id: balance.id,
                version: balance.version
            }, {
                pendingDays: balance.pendingDays + dto.days,
                version: balance.version + 1
            });
            if (updateResult.affected === 0) {
                throw new common_1.ConflictException('Data was modified concurrently');
            }
            const request = manager.create(time_off_request_entity_1.TimeOffRequest, {
                ...dto,
                status: time_off_request_entity_1.RequestStatus.PENDING,
            });
            return await manager.save(time_off_request_entity_1.TimeOffRequest, request);
        });
    }
    async getRequest(id) {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new common_1.NotFoundException('Request not found');
        }
        return request;
    }
    async updateRequestStatus(id, dto) {
        const request = await this.getRequest(id);
        if (dto.status === update_status_dto_1.UpdateRequestStatus.REJECTED && request.status !== time_off_request_entity_1.RequestStatus.REJECTED) {
            const balance = await this.balanceRepository.findOne({
                where: { employeeId: request.employeeId, locationId: request.locationId },
            });
            if (balance) {
                balance.pendingDays -= request.days;
                await this.balanceRepository.save(balance);
            }
        }
        request.status = dto.status;
        return await this.requestRepository.save(request);
    }
};
exports.TimeoffService = TimeoffService;
exports.TimeoffService = TimeoffService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(balance_record_entity_1.BalanceRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(time_off_request_entity_1.TimeOffRequest)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TimeoffService);
//# sourceMappingURL=timeoff.service.js.map