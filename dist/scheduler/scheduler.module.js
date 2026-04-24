"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const scheduler_service_1 = require("./scheduler.service");
const sync_module_1 = require("../sync/sync.module");
const time_off_request_entity_1 = require("../entities/time-off-request.entity");
const balance_record_entity_1 = require("../entities/balance-record.entity");
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            sync_module_1.SyncModule,
            typeorm_1.TypeOrmModule.forFeature([time_off_request_entity_1.TimeOffRequest, balance_record_entity_1.BalanceRecord])
        ],
        providers: [scheduler_service_1.SchedulerService]
    })
], SchedulerModule);
//# sourceMappingURL=scheduler.module.js.map