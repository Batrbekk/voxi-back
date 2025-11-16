import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PhoneService } from './phone.service';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { OutboundCallDto } from './dto/outbound-call.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('phone')
@UseGuards(JwtAuthGuard)
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  /**
   * Create a new phone number
   */
  @Post('numbers')
  async create(@Request() req, @Body() createPhoneNumberDto: CreatePhoneNumberDto) {
    const phoneNumber = await this.phoneService.create(
      req.user.companyId,
      createPhoneNumberDto,
    );

    return {
      success: true,
      data: phoneNumber,
      message: 'Номер телефона успешно создан',
    };
  }

  /**
   * Get all phone numbers
   */
  @Get('numbers')
  async findAll(@Request() req) {
    const phoneNumbers = await this.phoneService.findAll(req.user.companyId);

    return {
      success: true,
      data: phoneNumbers,
      count: phoneNumbers.length,
    };
  }

  /**
   * Get a single phone number
   */
  @Get('numbers/:id')
  async findOne(@Request() req, @Param('id') id: string) {
    const phoneNumber = await this.phoneService.findOne(req.user.companyId, id);

    return {
      success: true,
      data: phoneNumber,
    };
  }

  /**
   * Delete a phone number
   */
  @Delete('numbers/:id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.phoneService.remove(req.user.companyId, id);

    return {
      success: true,
      message: 'Номер телефона успешно удален',
    };
  }

  /**
   * Assign an agent to a phone number
   */
  @Patch('numbers/:id/assign-agent')
  async assignAgent(
    @Request() req,
    @Param('id') id: string,
    @Body() assignAgentDto: AssignAgentDto,
  ) {
    const phoneNumber = await this.phoneService.assignAgent(
      req.user.companyId,
      id,
      assignAgentDto,
    );

    return {
      success: true,
      data: phoneNumber,
      message: 'Агент успешно назначен на номер',
    };
  }

  /**
   * Make an outbound call via SIP trunk
   */
  @Post('outbound-call/sip-trunk')
  async makeOutboundCall(@Request() req, @Body() outboundCallDto: OutboundCallDto) {
    return this.phoneService.makeOutboundCall(req.user.companyId, outboundCallDto);
  }
}
