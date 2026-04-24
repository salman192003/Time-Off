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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncLog = exports.SyncStatus = exports.SyncType = void 0;
const typeorm_1 = require("typeorm");
var SyncType;
(function (SyncType) {
    SyncType["BATCH"] = "BATCH";
    SyncType["WEBHOOK"] = "WEBHOOK";
    SyncType["REALTIME"] = "REALTIME";
})(SyncType || (exports.SyncType = SyncType = {}));
var SyncStatus;
(function (SyncStatus) {
    SyncStatus["SUCCESS"] = "SUCCESS";
    SyncStatus["PARTIAL"] = "PARTIAL";
    SyncStatus["FAILED"] = "FAILED";
})(SyncStatus || (exports.SyncStatus = SyncStatus = {}));
let SyncLog = class SyncLog {
    id;
    type;
    triggeredBy;
    affectedEmployees;
    requestsRevalidated;
    requestsAutoRejected;
    status;
    errorDetail;
    createdAt;
};
exports.SyncLog = SyncLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SyncLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', enum: SyncType }),
    __metadata("design:type", String)
], SyncLog.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SyncLog.prototype, "triggeredBy", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], SyncLog.prototype, "affectedEmployees", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], SyncLog.prototype, "requestsRevalidated", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], SyncLog.prototype, "requestsAutoRejected", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', enum: SyncStatus }),
    __metadata("design:type", String)
], SyncLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SyncLog.prototype, "errorDetail", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SyncLog.prototype, "createdAt", void 0);
exports.SyncLog = SyncLog = __decorate([
    (0, typeorm_1.Entity)()
], SyncLog);
//# sourceMappingURL=sync-log.entity.js.map