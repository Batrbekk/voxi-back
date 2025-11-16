import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { BatchCallsService } from './batch-calls.service';
import { CreateBatchCallDto } from './dto/create-batch-call.dto';
import { UpdateBatchCallDto } from './dto/update-batch-call.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('phone/batch-calls')
@UseGuards(JwtAuthGuard)
export class BatchCallsController {
  constructor(private readonly batchCallsService: BatchCallsService) {}

  /**
   * Create a new batch call
   */
  @Post()
  async create(@Request() req, @Body() createBatchCallDto: CreateBatchCallDto) {
    const batchCall = await this.batchCallsService.create(
      req.user.companyId,
      createBatchCallDto,
    );

    return {
      success: true,
      data: batchCall,
      message: 'Batch call created successfully',
    };
  }

  /**
   * Get all batch calls
   */
  @Get()
  async findAll(
    @Request() req,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const batchCalls = await this.batchCallsService.findAll(
      req.user.companyId,
      pageSize,
    );

    return {
      success: true,
      data: batchCalls,
      count: batchCalls.length,
    };
  }

  /**
   * Get a single batch call
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const batchCall = await this.batchCallsService.findOne(req.user.companyId, id);

    return {
      success: true,
      data: batchCall,
    };
  }

  /**
   * Update a batch call
   */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateBatchCallDto: UpdateBatchCallDto,
  ) {
    const batchCall = await this.batchCallsService.update(
      req.user.companyId,
      id,
      updateBatchCallDto,
    );

    return {
      success: true,
      data: batchCall,
      message: 'Batch call updated successfully',
    };
  }

  /**
   * Delete a batch call
   */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.batchCallsService.remove(req.user.companyId, id);

    return {
      success: true,
      message: 'Batch call deleted successfully',
    };
  }

  /**
   * Cancel a batch call
   */
  @Post(':id/cancel')
  async cancel(@Request() req, @Param('id') id: string) {
    const batchCall = await this.batchCallsService.cancel(req.user.companyId, id);

    return {
      success: true,
      data: batchCall,
      message: 'Batch call cancelled successfully',
    };
  }
}
