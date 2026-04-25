import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { TimeOffRequest, RequestStatus } from './request.entity';

@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  async create(@Body() createRequestDto: CreateRequestDto): Promise<TimeOffRequest> {
    return this.requestService.create(createRequestDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<TimeOffRequest> {
    return this.requestService.findById(id);
  }

  @Get()
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
  ): Promise<TimeOffRequest[]> {
    return this.requestService.findAll({ employeeId, status });
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body('managerId') managerId: string,
  ): Promise<TimeOffRequest> {
    return this.requestService.approve(id, managerId);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body('managerId') managerId: string,
  ): Promise<TimeOffRequest> {
    return this.requestService.reject(id, managerId);
  }

  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Body('employeeId') bodyEmployeeId?: string,
    @Headers('employeeId') headerEmployeeId?: string,
  ): Promise<TimeOffRequest> {
    const employeeId = bodyEmployeeId || headerEmployeeId || '';
    return this.requestService.cancel(id, employeeId);
  }
}
