'use client';

import { EntityDocumentsSection } from './EntityDocumentsSection';

export function AssetDocuments({ assetId }: { assetId: string }) {
  return (
    <EntityDocumentsSection
      entityKind="asset"
      entityId={assetId}
      title="Документы ТС (СТС, ОСАГО и др.)"
    />
  );
}
