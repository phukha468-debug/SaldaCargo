export type { EmailAttachment, EmailProvider, SendEmailPayload, SendEmailResult } from './types';
export { SmtpEmailProvider, type SmtpProviderConfig } from './smtpProvider';
export { ResendEmailProvider, resolveEmailProvider } from './resendProvider';
