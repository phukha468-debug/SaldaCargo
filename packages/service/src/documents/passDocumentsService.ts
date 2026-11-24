import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, logger } from '@saldacargo/shared';
import { resolveEmailProvider } from '../providers/email';
import { DOCUMENTS_BUCKET, MAX_PACKAGE_TOTAL_SIZE_BYTES, validateDocumentFile } from './constants';
import { renderPassDocumentsEmail, type CompanySignatureInfo } from './emailTemplate';

export type DocumentEntityKind = 'driver' | 'asset';

export interface EntityDocumentRecord {
  id: string;
  entity_id: string;
  entity_kind: DocumentEntityKind;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_pass_package: boolean;
  created_at: string | null;
  created_by: string | null;
}

interface RawDriverDocRow {
  id: string;
  driver_id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_pass_package: boolean;
  created_at: string | null;
  created_by: string | null;
}

interface RawAssetDocRow {
  id: string;
  asset_id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_pass_package: boolean;
  created_at: string | null;
  created_by: string | null;
}

export interface PassSendBootstrapData {
  customers: Array<{
    id: string;
    name: string;
    email: string | null;
    contact_person: string | null;
    phone: string | null;
  }>;
  assets: Array<{
    id: string;
    reg_number: string;
    short_name: string;
    assigned_driver_id: string | null;
    documents: EntityDocumentRecord[];
  }>;
  drivers: Array<{
    id: string;
    name: string;
    phone: string | null;
    current_asset_id: string | null;
    documents: EntityDocumentRecord[];
  }>;
  company: CompanySignatureInfo;
  recentSends: Array<{
    id: string;
    recipient_email: string;
    subject: string | null;
    attachments_count: number;
    total_size_bytes: number;
    created_at: string;
  }>;
}

export interface SendPassPackageInput {
  organizationId: string;
  sentBy: string;
  recipientEmail: string;
  counterpartyId?: string | null;
  assetId?: string | null;
  driverId?: string | null;
  assetDocumentIds: string[];
  driverDocumentIds: string[];
  subject?: string | null;
  bodyText?: string | null;
  includeSignature?: boolean;
}

export interface SendPassPackageResult {
  sendId: string | null;
  messageId: string | null;
  provider: string;
  attachmentsCount: number;
  totalSizeBytes: number;
  recipientEmail: string;
}

function mapDriverDoc(row: RawDriverDocRow): EntityDocumentRecord {
  return {
    id: row.id,
    entity_id: row.driver_id,
    entity_kind: 'driver',
    organization_id: row.organization_id,
    file_name: row.file_name,
    file_path: row.file_path,
    file_type: row.file_type,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    is_pass_package: row.is_pass_package,
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

function mapAssetDoc(row: RawAssetDocRow): EntityDocumentRecord {
  return {
    id: row.id,
    entity_id: row.asset_id,
    entity_kind: 'asset',
    organization_id: row.organization_id,
    file_name: row.file_name,
    file_path: row.file_path,
    file_type: row.file_type,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    is_pass_package: row.is_pass_package,
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

async function assertEntityBelongsToOrg(
  supabase: SupabaseClient,
  organizationId: string,
  entityKind: DocumentEntityKind,
  entityId: string,
): Promise<void> {
  const table = entityKind === 'driver' ? 'users' : 'assets';
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', entityId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, `Ошибка проверки объекта: ${error.message}`);
  }
  if (!data) {
    throw new ApiError(
      404,
      entityKind === 'driver'
        ? 'Водитель не найден в вашей организации'
        : 'ТС не найдено в вашей организации',
      'ENTITY_NOT_FOUND',
    );
  }
}

export async function listEntityDocuments(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    entityKind: DocumentEntityKind;
    entityId: string;
  },
): Promise<EntityDocumentRecord[]> {
  await assertEntityBelongsToOrg(
    supabase,
    params.organizationId,
    params.entityKind,
    params.entityId,
  );

  if (params.entityKind === 'driver') {
    const { data, error } = await supabase
      .from('driver_documents')
      .select(
        'id, driver_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
      )
      .eq('organization_id', params.organizationId)
      .eq('driver_id', params.entityId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError(500, error.message);
    return ((data ?? []) as RawDriverDocRow[]).map(mapDriverDoc);
  }

  const { data, error } = await supabase
    .from('asset_documents')
    .select(
      'id, asset_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
    )
    .eq('organization_id', params.organizationId)
    .eq('asset_id', params.entityId)
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(500, error.message);
  return ((data ?? []) as RawAssetDocRow[]).map(mapAssetDoc);
}

export async function uploadEntityDocument(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    entityKind: DocumentEntityKind;
    entityId: string;
    uploadedBy: string;
    fileName: string;
    mimeType: string | null | undefined;
    buffer: Buffer;
    isPassPackage?: boolean;
  },
): Promise<EntityDocumentRecord> {
  await assertEntityBelongsToOrg(
    supabase,
    params.organizationId,
    params.entityKind,
    params.entityId,
  );

  const meta = validateDocumentFile(params.fileName, params.mimeType, params.buffer.byteLength);
  const folder = params.entityKind === 'driver' ? 'drivers' : 'assets';
  const filePath = `${params.organizationId}/${folder}/${params.entityId}/${randomUUID()}.${meta.extension}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, params.buffer, {
      contentType: meta.canonicalMimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiError(500, `Ошибка загрузки файла в хранилище: ${uploadError.message}`);
  }

  const isPassPackage = params.isPassPackage !== false;

  if (params.entityKind === 'driver') {
    const { data, error } = await supabase
      .from('driver_documents')
      .insert({
        organization_id: params.organizationId,
        driver_id: params.entityId,
        file_name: meta.cleanFileName,
        file_path: filePath,
        file_type: meta.extension,
        file_size_bytes: params.buffer.byteLength,
        mime_type: meta.canonicalMimeType,
        is_pass_package: isPassPackage,
        created_by: params.uploadedBy,
      })
      .select(
        'id, driver_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
      )
      .single();

    if (error || !data) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
      throw new ApiError(
        500,
        `Ошибка сохранения метаданных документа: ${error?.message ?? 'unknown'}`,
      );
    }
    return mapDriverDoc(data as RawDriverDocRow);
  }

  const { data, error } = await supabase
    .from('asset_documents')
    .insert({
      organization_id: params.organizationId,
      asset_id: params.entityId,
      file_name: meta.cleanFileName,
      file_path: filePath,
      file_type: meta.extension,
      file_size_bytes: params.buffer.byteLength,
      mime_type: meta.canonicalMimeType,
      is_pass_package: isPassPackage,
      created_by: params.uploadedBy,
    })
    .select(
      'id, asset_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
    )
    .single();

  if (error || !data) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
    throw new ApiError(
      500,
      `Ошибка сохранения метаданных документа ТС: ${error?.message ?? 'unknown'}`,
    );
  }
  return mapAssetDoc(data as RawAssetDocRow);
}

export async function updateEntityDocument(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    entityKind: DocumentEntityKind;
    documentId: string;
    isPassPackage?: boolean;
    fileName?: string;
  },
): Promise<EntityDocumentRecord> {
  const patch: { is_pass_package?: boolean; file_name?: string } = {};
  if (typeof params.isPassPackage === 'boolean') patch.is_pass_package = params.isPassPackage;
  if (params.fileName?.trim()) patch.file_name = params.fileName.trim().slice(0, 180);

  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, 'Нет полей для обновления');
  }

  if (params.entityKind === 'driver') {
    const { data, error } = await supabase
      .from('driver_documents')
      .update(patch)
      .eq('id', params.documentId)
      .eq('organization_id', params.organizationId)
      .select(
        'id, driver_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
      )
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, 'Документ не найден');
    return mapDriverDoc(data as RawDriverDocRow);
  }

  const { data, error } = await supabase
    .from('asset_documents')
    .update(patch)
    .eq('id', params.documentId)
    .eq('organization_id', params.organizationId)
    .select(
      'id, asset_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
    )
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, 'Документ не найден');
  return mapAssetDoc(data as RawAssetDocRow);
}

export async function deleteEntityDocument(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    entityKind: DocumentEntityKind;
    documentId: string;
  },
): Promise<void> {
  const table = params.entityKind === 'driver' ? 'driver_documents' : 'asset_documents';
  const { data, error } = await supabase
    .from(table)
    .select('id, file_path')
    .eq('id', params.documentId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, 'Документ не найден');

  const row = data as { id: string; file_path: string };
  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([row.file_path]);

  if (storageError) {
    logger.warn('Failed to remove file from storage during delete', {
      filePath: row.file_path,
      error: storageError.message,
    });
  }

  const { error: delError } = await supabase
    .from(table)
    .delete()
    .eq('id', row.id)
    .eq('organization_id', params.organizationId);

  if (delError) throw new ApiError(500, delError.message);
}

export async function getEntityDocumentSignedUrl(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    entityKind: DocumentEntityKind;
    documentId: string;
    expiresIn?: number;
  },
): Promise<{ url: string; fileName: string }> {
  const table = params.entityKind === 'driver' ? 'driver_documents' : 'asset_documents';
  const { data, error } = await supabase
    .from(table)
    .select('id, file_name, file_path')
    .eq('id', params.documentId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, 'Документ не найден');

  const row = data as { id: string; file_name: string; file_path: string };
  const ttl = Math.min(Math.max(params.expiresIn ?? 60, 30), 3600);
  const { data: signed, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(row.file_path, ttl);

  if (signError || !signed?.signedUrl) {
    throw new ApiError(500, signError?.message ?? 'Не удалось сгенерировать ссылку на файл');
  }

  return { url: signed.signedUrl, fileName: row.file_name };
}

async function loadCompanySignatureInfo(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CompanySignatureInfo> {
  const [orgRes, legalRes] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
    supabase
      .from('legal_entities')
      .select('name, inn, kpp, ogrn, legal_address')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const orgName = (orgRes.data as { name?: string } | null)?.name || 'Транспортная компания';
  const legal = legalRes.data as {
    name?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    legal_address?: string | null;
  } | null;

  return {
    organizationName: orgName,
    legalEntityName: legal?.name ?? null,
    inn: legal?.inn ?? null,
    kpp: legal?.kpp ?? null,
    ogrn: legal?.ogrn ?? null,
    legalAddress: legal?.legal_address ?? null,
  };
}

export async function getPassSendBootstrapData(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PassSendBootstrapData> {
  const [customersRes, assetsRes, driversRes, assetDocsRes, driverDocsRes, sendsRes, company] =
    await Promise.all([
      supabase
        .from('counterparties')
        .select('id, name, email, contact_person, phone')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('type', ['client', 'both'])
        .order('name', { ascending: true }),
      supabase
        .from('assets')
        .select('id, reg_number, short_name, assigned_driver_id')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'reserve', 'repair'])
        .order('reg_number', { ascending: true }),
      supabase
        .from('users')
        .select('id, name, phone, current_asset_id, roles')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .contains('roles', ['driver'])
        .order('name', { ascending: true }),
      supabase
        .from('asset_documents')
        .select(
          'id, asset_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('driver_documents')
        .select(
          'id, driver_id, organization_id, file_name, file_path, file_type, file_size_bytes, mime_type, is_pass_package, created_at, created_by',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('document_sends')
        .select('id, recipient_email, subject, attachments_count, total_size_bytes, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5),
      loadCompanySignatureInfo(supabase, organizationId),
    ]);

  const assetDocsByAsset = new Map<string, EntityDocumentRecord[]>();
  for (const row of (assetDocsRes.data ?? []) as RawAssetDocRow[]) {
    const mapped = mapAssetDoc(row);
    const list = assetDocsByAsset.get(row.asset_id) ?? [];
    list.push(mapped);
    assetDocsByAsset.set(row.asset_id, list);
  }

  const driverDocsByDriver = new Map<string, EntityDocumentRecord[]>();
  for (const row of (driverDocsRes.data ?? []) as RawDriverDocRow[]) {
    const mapped = mapDriverDoc(row);
    const list = driverDocsByDriver.get(row.driver_id) ?? [];
    list.push(mapped);
    driverDocsByDriver.set(row.driver_id, list);
  }

  const assets = (
    (assetsRes.data ?? []) as Array<{
      id: string;
      reg_number: string;
      short_name: string;
      assigned_driver_id: string | null;
    }>
  ).map((a) => ({
    ...a,
    documents: assetDocsByAsset.get(a.id) ?? [],
  }));

  const drivers = (
    (driversRes.data ?? []) as Array<{
      id: string;
      name: string;
      phone: string | null;
      current_asset_id: string | null;
    }>
  ).map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    current_asset_id: d.current_asset_id,
    documents: driverDocsByDriver.get(d.id) ?? [],
  }));

  return {
    customers: (customersRes.data ?? []) as PassSendBootstrapData['customers'],
    assets,
    drivers,
    company,
    recentSends: (sendsRes.data ?? []) as PassSendBootstrapData['recentSends'],
  };
}

export async function sendPassDocumentsPackage(
  supabase: SupabaseClient,
  input: SendPassPackageInput,
): Promise<SendPassPackageResult> {
  const uniqueAssetDocIds = Array.from(new Set(input.assetDocumentIds));
  const uniqueDriverDocIds = Array.from(new Set(input.driverDocumentIds));

  if (uniqueAssetDocIds.length === 0 && uniqueDriverDocIds.length === 0) {
    throw new ApiError(400, 'Выберите хотя бы один документ для отправки', 'NO_DOCUMENTS_SELECTED');
  }

  // 1. Проверяем принадлежность опциональных сущностей текущей организации
  if (input.counterpartyId) {
    const { data: cp } = await supabase
      .from('counterparties')
      .select('id')
      .eq('id', input.counterpartyId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!cp) throw new ApiError(404, 'Заказчик не найден в вашей организации');
  }

  let assetInfo: { reg_number: string; short_name: string } | null = null;
  if (input.assetId) {
    const { data: asset } = await supabase
      .from('assets')
      .select('id, reg_number, short_name')
      .eq('id', input.assetId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!asset) throw new ApiError(404, 'ТС не найдено в вашей организации');
    assetInfo = asset as { reg_number: string; short_name: string };
  }

  let driverInfo: { name: string; phone: string | null } | null = null;
  if (input.driverId) {
    const { data: driver } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('id', input.driverId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!driver) throw new ApiError(404, 'Водитель не найден в вашей организации');
    driverInfo = driver as { name: string; phone: string | null };
  }

  // 2. Загружаем метаданные документов строго в рамках organization_id
  const selectedDocs: Array<{
    id: string;
    kind: DocumentEntityKind;
    file_name: string;
    file_path: string;
    mime_type: string | null;
  }> = [];

  if (uniqueAssetDocIds.length > 0) {
    const { data, error } = await supabase
      .from('asset_documents')
      .select('id, file_name, file_path, mime_type')
      .eq('organization_id', input.organizationId)
      .in('id', uniqueAssetDocIds);

    if (error) throw new ApiError(500, error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      file_name: string;
      file_path: string;
      mime_type: string | null;
    }>;
    if (rows.length !== uniqueAssetDocIds.length) {
      throw new ApiError(403, 'Часть документов ТС не найдена или принадлежит другой организации');
    }
    for (const r of rows) selectedDocs.push({ ...r, kind: 'asset' });
  }

  if (uniqueDriverDocIds.length > 0) {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('id, file_name, file_path, mime_type')
      .eq('organization_id', input.organizationId)
      .in('id', uniqueDriverDocIds);

    if (error) throw new ApiError(500, error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      file_name: string;
      file_path: string;
      mime_type: string | null;
    }>;
    if (rows.length !== uniqueDriverDocIds.length) {
      throw new ApiError(
        403,
        'Часть документов водителя не найдена или принадлежит другой организации',
      );
    }
    for (const r of rows) selectedDocs.push({ ...r, kind: 'driver' });
  }

  // 3. Скачиваем файлы напрямую из Supabase Storage (без SSRF) и проверяем общий лимит 20 МБ
  let totalSizeBytes = 0;
  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];

  for (const doc of selectedDocs) {
    const { data: blob, error: dlError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(doc.file_path);

    if (dlError || !blob) {
      throw new ApiError(
        500,
        `Не удалось скачать файл «${doc.file_name}» из хранилища: ${dlError?.message ?? 'empty'}`,
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    totalSizeBytes += buffer.byteLength;

    if (totalSizeBytes > MAX_PACKAGE_TOTAL_SIZE_BYTES) {
      throw new ApiError(
        400,
        `Общий размер вложений превышает лимит 20 МБ (${(totalSizeBytes / 1024 / 1024).toFixed(1)} МБ). Уберите часть файлов.`,
        'PACKAGE_TOO_LARGE',
      );
    }

    attachments.push({
      filename: doc.file_name,
      content: buffer,
      contentType: doc.mime_type ?? undefined,
    });
  }

  // 4. Резолвим EmailProvider и рендерим HTML + text письмо
  const emailProvider = await resolveEmailProvider(supabase, input.organizationId);
  const company = await loadCompanySignatureInfo(supabase, input.organizationId);
  company.fromEmail = emailProvider.fromEmail;

  const rendered = renderPassDocumentsEmail({
    driverName: driverInfo?.name ?? null,
    driverPhone: driverInfo?.phone ?? null,
    assetRegNumber: assetInfo?.reg_number ?? null,
    assetShortName: assetInfo?.short_name ?? null,
    customSubject: input.subject ?? null,
    customBody: input.bodyText ?? null,
    includeSignature: input.includeSignature !== false,
    company,
    attachmentNames: attachments.map((a) => a.filename),
  });

  const sendResult = await emailProvider.send({
    to: input.recipientEmail.trim(),
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    attachments,
  });

  // 5. Логируем отправку в public.document_sends
  const { data: logRow, error: logError } = await supabase
    .from('document_sends')
    .insert({
      organization_id: input.organizationId,
      sent_by: input.sentBy,
      recipient_email: input.recipientEmail.trim(),
      counterparty_id: input.counterpartyId ?? null,
      asset_id: input.assetId ?? null,
      driver_id: input.driverId ?? null,
      document_ids: selectedDocs.map((d) => ({ id: d.id, kind: d.kind, file_name: d.file_name })),
      subject: rendered.subject,
      attachments_count: attachments.length,
      total_size_bytes: totalSizeBytes,
      provider: sendResult.provider,
      external_message_id: sendResult.messageId,
    })
    .select('id')
    .maybeSingle();

  if (logError) {
    logger.warn('Failed to log document send', { error: logError.message });
  }

  return {
    sendId: (logRow as { id?: string } | null)?.id ?? null,
    messageId: sendResult.messageId,
    provider: sendResult.provider,
    attachmentsCount: attachments.length,
    totalSizeBytes,
    recipientEmail: input.recipientEmail.trim(),
  };
}
