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
exports.TimeoffController = void 0;
const common_1 = require("@nestjs/common");
const timeoff_service_1 = require("./timeoff.service");
const create_time_off_request_dto_1 = require("./dto/create-time-off-request.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
let TimeoffController = class TimeoffController {
    timeoffService;
    constructor(timeoffService) {
        this.timeoffService = timeoffService;
    }
    getBalance(employeeId, locationId) {
        return this.timeoffService.getBalance(employeeId, locationId);
    }
    createRequest(dto) {
        return this.timeoffService.createRequest(dto);
    }
    getRequest(id) {
        return this.timeoffService.getRequest(id);
    }
    updateRequestStatus(id, dto) {
        return this.timeoffService.updateRequestStatus(id, dto);
    }
};
exports.TimeoffController = TimeoffController;
__decorate([
    (0, common_1.Get)('balance/:employeeId/:locationId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __param(1, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)('time-off/requests'),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_time_off_request_dto_1.CreateTimeOffRequestDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Get)('time-off/requests/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "getRequest", null);
__decorate([
    (0, common_1.Patch)('time-off/requests/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_status_dto_1.UpdateStatusDto]),
    __metadata("design:returntype", void 0)
], TimeoffController.prototype, "updateRequestStatus", null);
exports.TimeoffController = TimeoffController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [timeoff_service_1.TimeoffService])
], TimeoffController);
//# sourceMappingURL=timeoff.controller.js.map