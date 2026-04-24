"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const balance_record_entity_1 = require("./entities/balance-record.entity");
const time_off_request_entity_1 = require("./entities/time-off-request.entity");
const sync_log_entity_1 = require("./entities/sync-log.entity");
const timeoff_module_1 = require("./timeoff/timeoff.module");
const sync_module_1 = require("./sync/sync.module");
const schedule_1 = require("@nestjs/schedule");
const mock_hcm_module_1 = require("./mock-hcm/mock-hcm.module");
const scheduler_module_1 = require("./scheduler/scheduler.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: 'database.sqlite',
                entities: [balance_record_entity_1.BalanceRecord, time_off_request_entity_1.TimeOffRequest, sync_log_entity_1.SyncLog],
                synchronize: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            timeoff_module_1.TimeoffModule,
            sync_module_1.SyncModule,
            mock_hcm_module_1.MockHcmModule,
            scheduler_module_1.SchedulerModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map