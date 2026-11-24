export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export interface SendEmailResult {
  provider: string;
  messageId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  readonly fromEmail: string;
  send(payload: SendEmailPayload): Promise<SendEmailResult>;
}
