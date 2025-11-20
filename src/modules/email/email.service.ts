import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;
  private readonly emailFrom: string;

  constructor(private configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    this.emailFrom = this.configService.get<string>('EMAIL_FROM') || 'Voxi <noreply@voxi.kz>';

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'info@voxi.kz',
        pass: 'glnu hrpj ybcv dtdq',
      },
    });
  }

  async sendVerificationEmail(email: string, token: string, name: string) {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Добро пожаловать в Voxi!</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${name}!</p>
            <p>Спасибо за регистрацию в Voxi. Пожалуйста, подтвердите свой email адрес, нажав на кнопку ниже:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Подтвердить Email</a>
            </div>
            <p>Или скопируйте эту ссылку в браузер:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>Эта ссылка действительна в течение 24 часов.</p>
            <p>Если вы не регистрировались в Voxi, просто проигнорируйте это письмо.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Voxi. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Подтверждение Email - Voxi',
        html,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email успешно подтвержден!</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${name}!</p>
            <p>Ваш email адрес был успешно подтвержден. Теперь вы можете в полной мере использовать все возможности Voxi!</p>
            <p>Что дальше?</p>
            <ul>
              <li>Настройте профиль вашей компании</li>
              <li>Добавьте членов команды</li>
              <li>Начните создавать AI агентов для звонков</li>
              <li>Управляйте лидами и кампаниями</li>
            </ul>
            <div style="text-align: center;">
              <a href="${this.frontendUrl}/dashboard" class="button">Перейти в Dashboard</a>
            </div>
            <p>Если у вас есть вопросы, напишите нам на info@voxi.kz</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Voxi. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Добро пожаловать в Voxi!',
        html,
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string, name: string) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Восстановление пароля</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${name}!</p>
            <p>Мы получили запрос на восстановление пароля для вашего аккаунта Voxi.</p>
            <p>Чтобы сбросить пароль, нажмите на кнопку ниже:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Сбросить пароль</a>
            </div>
            <p>Или скопируйте эту ссылку в браузер:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <div class="warning">
              <strong>Внимание!</strong> Эта ссылка действительна только 1 час.
            </div>
            <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо. Ваш пароль останется без изменений.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Voxi. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Восстановление пароля - Voxi',
        html,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
      throw error;
    }
  }

  async sendPasswordChangedEmail(email: string, name: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Пароль успешно изменен</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${name}!</p>
            <div class="success">
              Ваш пароль был успешно изменен.
            </div>
            <p>Теперь вы можете войти в систему, используя новый пароль.</p>
            <p>Если вы не изменяли пароль, немедленно свяжитесь с нами по адресу info@voxi.kz</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Voxi. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Пароль изменен - Voxi',
        html,
      });
      this.logger.log(`Password changed confirmation sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${email}`, error);
      throw error;
    }
  }

  async sendManagerInvitation(email: string, name: string, temporaryPassword: string) {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .credentials { background: #fff; border: 2px solid #667eea; border-radius: 5px; padding: 20px; margin: 20px 0; }
          .credentials-item { margin: 10px 0; }
          .credentials-label { font-weight: bold; color: #667eea; }
          .credentials-value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 3px; display: inline-block; margin-left: 10px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Приглашение в команду Voxi</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${name}!</p>
            <p>Вы были приглашены в качестве менеджера в систему Voxi. Теперь у вас есть доступ к CRM системе для управления лидами и звонками.</p>

            <div class="credentials">
              <h3 style="margin-top: 0; color: #667eea;">Ваши учетные данные:</h3>
              <div class="credentials-item">
                <span class="credentials-label">Email:</span>
                <span class="credentials-value">${email}</span>
              </div>
              <div class="credentials-item">
                <span class="credentials-label">Временный пароль:</span>
                <span class="credentials-value">${temporaryPassword}</span>
              </div>
            </div>

            <div class="warning">
              <strong>Важно!</strong> При первом входе вы будете обязаны сменить временный пароль на свой собственный.
            </div>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Войти в систему</a>
            </div>

            <p><strong>Что вы можете делать как менеджер:</strong></p>
            <ul>
              <li>Просматривать и управлять лидами</li>
              <li>Совершать звонки через веб-приложение</li>
              <li>Просматривать историю разговоров и транскрипции</li>
              <li>Получать AI-анализ разговоров</li>
              <li>Отслеживать статистику и производительность</li>
            </ul>

            <p>Если у вас есть вопросы, обратитесь к администратору вашей компании или напишите нам на info@voxi.kz</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Voxi. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Приглашение в команду - Voxi',
        html,
      });
      this.logger.log(`Manager invitation sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send manager invitation to ${email}`, error);
      throw error;
    }
  }
}
