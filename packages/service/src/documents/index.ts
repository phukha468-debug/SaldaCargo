export {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  MAX_PACKAGE_TOTAL_SIZE_BYTES,
  ALLOWED_DOCUMENT_EXTENSIONS,
  validateDocumentFile,
  type AllowedDocumentExtension,
  type ValidatedDocumentMeta,
} from './constants';

export {
  buildDefaultPassSubject,
  buildDefaultPassBody,
  buildCompanySignatureText,
  renderPassDocumentsEmail,
  type CompanySignatureInfo,
  type PassEmailTemplateInput,
  type RenderedPassEmail,
} from './emailTemplate';

export {
  driverDocumentsListQuerySchema,
  assetDocumentsListQuerySchema,
  documentUrlQuerySchema,
  documentDeleteBodySchema,
  documentUpdateBodySchema,
  sendPassPackageBodySchema,
  type SendPassPackageBody,
} from './schemas';

export {
  listEntityDocuments,
  uploadEntityDocument,
  updateEntityDocument,
  deleteEntityDocument,
  getEntityDocumentSignedUrl,
  getPassSendBootstrapData,
  sendPassDocumentsPackage,
  type DocumentEntityKind,
  type EntityDocumentRecord,
  type PassSendBootstrapData,
  type SendPassPackageInput,
  type SendPassPackageResult,
} from './passDocumentsService';
