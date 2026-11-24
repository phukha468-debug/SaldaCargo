import { ApiError } from '@saldacargo/shared';

export const DOCUMENTS_BUCKET = 'driver-documents';
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PACKAGE_TOTAL_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_DOCUMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'docx'] as const;
export type AllowedDocumentExtension = (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number];

const EXTENSION_TO_MIME: Record<AllowedDocumentExtension, readonly string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // некоторые браузеры/ОС отправляют .docx с generic MIME
  ],
};

const CANONICAL_MIME: Record<AllowedDocumentExtension, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface ValidatedDocumentMeta {
  cleanFileName: string;
  extension: AllowedDocumentExtension;
  canonicalMimeType: string;
}

export function validateDocumentFile(
  fileName: string,
  mimeType: string | null | undefined,
  sizeBytes: number,
): ValidatedDocumentMeta {
  const trimmedName = fileName.trim();
  if (!trimmedName) {
    throw new ApiError(400, 'Не указано имя файла', 'INVALID_FILE_NAME');
  }

  if (sizeBytes <= 0) {
    throw new ApiError(400, 'Файл пустой', 'EMPTY_FILE');
  }

  if (sizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new ApiError(
      400,
      `Размер файла превышает лимит 10 МБ (${(sizeBytes / 1024 / 1024).toFixed(1)} МБ)`,
      'FILE_TOO_LARGE',
    );
  }

  const lastDot = trimmedName.lastIndexOf('.');
  const extRaw = lastDot >= 0 ? trimmedName.slice(lastDot + 1).toLowerCase() : '';
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extRaw as AllowedDocumentExtension)) {
    throw new ApiError(
      400,
      'Недопустимый формат файла. Разрешены: JPG, PNG, PDF, DOCX.',
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  const extension = extRaw as AllowedDocumentExtension;
  const normalizedMime = ((mimeType || '').split(';')[0] ?? '').trim().toLowerCase();
  const allowedMimes = EXTENSION_TO_MIME[extension];

  if (normalizedMime && !allowedMimes.includes(normalizedMime)) {
    throw new ApiError(
      400,
      `MIME-тип файла (${normalizedMime}) не соответствует расширению .${extension}`,
      'MIME_MISMATCH',
    );
  }

  // Убираем потенциальные разделители пути из оригинального имени для безопасного хранения
  const cleanFileName = trimmedName.replace(/[/\\]/g, '_').slice(0, 180);

  return {
    cleanFileName,
    extension,
    canonicalMimeType: CANONICAL_MIME[extension],
  };
}
