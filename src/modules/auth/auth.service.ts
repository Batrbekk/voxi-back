import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole, UserStatus } from '../../schemas/user.schema';
import { Company, CompanyDocument, CompanyStatus } from '../../schemas/company.schema';
import { EmailService } from '../email/email.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, createCompany, companyName, companyEmail, companyPhone } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    let company: CompanyDocument;

    // Create company if requested or if it's the first user
    if (createCompany) {
      if (!companyName || !companyEmail) {
        throw new BadRequestException('Company name and email are required when creating a company');
      }

      // Check if company with this email exists
      const existingCompany = await this.companyModel.findOne({ email: companyEmail.toLowerCase() });
      if (existingCompany) {
        throw new ConflictException('Company with this email already exists');
      }

      // Create new company
      company = await this.companyModel.create({
        name: companyName,
        email: companyEmail.toLowerCase(),
        phone: companyPhone,
        status: CompanyStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      });

      this.logger.log(`Company created: ${company.name} (${company._id})`);
    } else {
      // For now, we require company creation during registration
      // In the future, you might want to implement company invitations
      throw new BadRequestException('Company creation is required during registration');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await this.userModel.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      companyId: company._id,
      role: createCompany ? UserRole.COMPANY_ADMIN : UserRole.AGENT,
      status: UserStatus.PENDING,
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationExpiry,
    });

    this.logger.log(`User registered: ${user.email} (${user._id})`);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(user.email, emailVerificationToken, user.firstName);
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
      // Don't throw error here, user is already created
    }

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user._id,
      companyId: company._id,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.status = UserStatus.ACTIVE;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    this.logger.log(`Email verified for user: ${user.email}`);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);
    } catch (error) {
      this.logger.error('Failed to send welcome email', error);
    }

    return {
      message: 'Email verified successfully. You can now login.',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email: email.toLowerCase() }).populate('companyId');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Your account is not active');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await user.save();

    this.logger.log(`User logged in: ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    // Don't reveal if user exists
    if (!user) {
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
      this.logger.log(`Password reset email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    this.logger.log(`Password reset for user: ${user.email}`);

    // Send confirmation email
    try {
      await this.emailService.sendPasswordChangedEmail(user.email, user.firstName);
    } catch (error) {
      this.logger.error('Failed to send password changed email', error);
    }

    return {
      message: 'Password reset successfully. Please login with your new password.',
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userModel.findById(payload.sub);

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify refresh token
      const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update refresh token
      user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
      await user.save();

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    const user = await this.userModel.findById(userId);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
      this.logger.log(`User logged out: ${user.email}`);
    }

    return {
      message: 'Logged out successfully',
    };
  }

  private async generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') || 'default-secret',
        expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '7d') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret',
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '30d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
