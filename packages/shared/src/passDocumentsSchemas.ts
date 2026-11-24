import { z } from 'zod';

export const driverDocumentsListQuerySchema = z.object({
  driverId: z.string().uuid('Некорректный ID водителя'),
});

export const assetDocumentsListQuerySchema = z.object({
  assetId: z.string().uuid('Некорректный ID ТС'),
});

export const documentUrlQuerySchema = z.object({
  id: z.string().uuid('Некорректный ID документа'),
  expiresIn: z.coerce.number().int().min(30).max(3600).optional(),
});

export const documentDeleteBodySchema = z.object({
  id: z.string().uuid('Некорректный ID документа'),
});

export const documentUpdateBodySchema = z.object({
  id: z.string().uuid('Некорректный ID документа'),
  isPassPackage: z.boolean().optional(),
  fileName: z.string().trim().min(1).max(180).optional(),
});

export const sendPassPackageBodySchema = z.object({
  recipientEmail: z.string().trim().email('Укажите корректный email получателя'),
  counterpartyId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  driverId: z.string().uuid().nullable().optional(),
  assetDocumentIds: z.array(z.string().uuid()).max(20).default([]),
  driverDocumentIds: z.array(z.string().uuid()).max(20).default([]),
  subject: z.string().trim().max(200).nullable().optional(),
  bodyText: z.string().trim().max(5000).nullable().optional(),
  includeSignature: z.boolean().optional(),
});

export type SendPassPackageBody = z.infer<typeof sendPassPackageBodySchema>;
