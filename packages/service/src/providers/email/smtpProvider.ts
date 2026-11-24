import nodemailer from 'nodemailer';
import { ApiError, logger } from '@saldacargo/shared';
import type { EmailProvider, SendEmailPayload, SendEmailResult } from './types';

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
}

export class SmtpEmailProvider implements EmailProvider {
  public readonly name = 'smtp';
  public readonly fromEmail: string;
  private readonly cfg: SmtpProviderConfig;

  constructor(cfg: SmtpProviderConfig) {
    this.cfg = cfg;
    this.fromEmail = cfg.fromName?.trim()
      ? `"${cfg.fromName.trim().replace(/"/g, '')}" <${cfg.user}>`
      : cfg.user;
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const transporter = nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: {
        user: this.cfg.user,
        pass: this.cfg.pass,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    try {
      const info = await transporter.sendMail({
        from: this.fromEmail,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        ...(payload.attachments && payload.attachments.length > 0
          ? {
              attachments: payload.attachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                ...(att.contentType ? { contentType: att.contentType } : {}),
              })),
            }
          : {}),
      });

      return {
        provider: this.name,
        messageId: info.messageId ?? null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'SMTP error';
      logger.error('SMTP sendMail error', { host: this.cfg.host, port: this.cfg.port, message });
      throw new ApiError(
        502,
        `Ошибка отправки через SMTP (${this.cfg.host}): ${message}`,
        'SMTP_PROVIDER_ERROR',
      );
    }
  }
}
