export interface CompanySignatureInfo {
  organizationName: string;
  legalEntityName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  fromEmail?: string | null;
}

export interface PassEmailTemplateInput {
  driverName?: string | null;
  driverPhone?: string | null;
  assetRegNumber?: string | null;
  assetShortName?: string | null;
  customSubject?: string | null;
  customBody?: string | null;
  includeSignature?: boolean;
  company: CompanySignatureInfo;
  attachmentNames: string[];
}

export interface RenderedPassEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildDefaultPassSubject(input: {
  driverName?: string | null;
  assetRegNumber?: string | null;
}): string {
  const parts: string[] = [];
  if (input.driverName?.trim()) parts.push(input.driverName.trim());
  if (input.assetRegNumber?.trim()) parts.push(input.assetRegNumber.trim());
  return parts.length > 0
    ? `Документы для пропуска: ${parts.join(' · ')}`
    : 'Документы для оформления пропуска';
}

export function buildDefaultPassBody(input: {
  driverName?: string | null;
  driverPhone?: string | null;
  assetRegNumber?: string | null;
  assetShortName?: string | null;
}): string {
  const lines: string[] = [
    'Добрый день!',
    '',
    'Направляем пакет документов для оформления пропуска на въезд:',
  ];
  if (input.driverName?.trim()) {
    const phonePart = input.driverPhone?.trim() ? ` (${input.driverPhone.trim()})` : '';
    lines.push(`• Водитель: ${input.driverName.trim()}${phonePart}`);
  }
  if (input.assetRegNumber?.trim() || input.assetShortName?.trim()) {
    const vehicleLabel = [input.assetShortName?.trim(), input.assetRegNumber?.trim()]
      .filter(Boolean)
      .join(', госномер ');
    lines.push(`• ТС: ${vehicleLabel}`);
  }
  lines.push('', 'Документы во вложении.');
  return lines.join('\n');
}

export function buildCompanySignatureText(company: CompanySignatureInfo): string {
  const displayName = company.legalEntityName?.trim() || company.organizationName;
  const reqParts: string[] = [];
  if (company.inn?.trim()) reqParts.push(`ИНН ${company.inn.trim()}`);
  if (company.kpp?.trim()) reqParts.push(`КПП ${company.kpp.trim()}`);
  if (company.ogrn?.trim()) reqParts.push(`ОГРН ${company.ogrn.trim()}`);

  const lines: string[] = ['--', `С уважением, ${displayName}`];
  if (reqParts.length > 0) lines.push(reqParts.join(' · '));
  if (company.legalAddress?.trim()) lines.push(company.legalAddress.trim());
  if (company.fromEmail?.trim()) lines.push(company.fromEmail.trim());
  return lines.join('\n');
}

export function renderPassDocumentsEmail(input: PassEmailTemplateInput): RenderedPassEmail {
  const subject = input.customSubject?.trim() || buildDefaultPassSubject(input);
  const bodyCore = input.customBody?.trim() || buildDefaultPassBody(input);
  const includeSignature = input.includeSignature !== false;
  const signatureText = includeSignature ? buildCompanySignatureText(input.company) : '';

  const text = signatureText ? `${bodyCore}\n\n${signatureText}` : bodyCore;

  const htmlBodyParagraphs = bodyCore
    .split('\n')
    .map((line) =>
      line.trim() === '' ? '<br />' : `<p style="margin:0 0 6px 0;">${escapeHtml(line)}</p>`,
    )
    .join('');

  const htmlAttachments =
    input.attachmentNames.length > 0
      ? `<div style="margin-top:16px;padding:10px 12px;background:#F6F7F8;border:1px solid #E7E8EA;border-radius:10px;">
           <div style="font-size:12px;font-weight:700;color:#111111;margin-bottom:4px;">Во вложении (${input.attachmentNames.length}):</div>
           <div style="font-size:12px;color:#4B5563;">${input.attachmentNames.map(escapeHtml).join(', ')}</div>
         </div>`
      : '';

  const htmlSignature = includeSignature
    ? `<div style="margin-top:18px;padding-top:12px;border-top:1px solid #E7E8EA;font-size:12px;color:#666B73;white-space:pre-line;">${escapeHtml(signatureText)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0;padding:16px;background:#F6F7F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111111;">
    <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E8EA;border-radius:16px;padding:20px 24px;font-size:14px;line-height:1.5;">
      ${htmlBodyParagraphs}
      ${htmlAttachments}
      ${htmlSignature}
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
