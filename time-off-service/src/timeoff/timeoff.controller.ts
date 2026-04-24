import { Controller, Get, Post, Patch, Param, Body, ValidationPipe } from '@nestjs/common';
import { TimeoffService } from './timeoff.service';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller()
export class TimeoffController {
  constructor(private readonly timeoffService: TimeoffService) {}

  @Get('balance/:employeeId/:locationId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.timeoffService.getBalance(employeeId, locationId);
  }

  @Post('time-off/requests')
  createRequest(@Body(ValidationPipe) dto: CreateTimeOffRequestDto) {
    return this.timeoffService.createRequest(dto);
  }

  @Get('time-off/requests/:id')
  getRequest(@Param('id') id: string) {
    return this.timeoffService.getRequest(id);
  }

  @Patch('time-off/requests/:id')
  updateRequestStatus(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateStatusDto,
  ) {
    return this.timeoffService.updateRequestStatus(id, dto);
  }
}
