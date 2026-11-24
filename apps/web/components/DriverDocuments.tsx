'use client';

import { EntityDocumentsSection } from './EntityDocumentsSection';

export function DriverDocuments({ driverId }: { driverId: string }) {
  return (
    <EntityDocumentsSection entityKind="driver" entityId={driverId} title="Документы водителя" />
  );
}
