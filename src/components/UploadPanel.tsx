import { ChangeEvent, useMemo, useState } from 'react';
import { db } from '../db/appDb';
import type { PendingUpload, UserRecord } from '../types';
import {
  SHEET_VALIDITY_YEARS,
  calculateExpirationFromDocumentDate,
  daysUntilExpiration,
  getSheetStatus,
  getStatusLabel,
  isValidDateInput
} from '../utils/date';

interface UploadPanelProps {
  currentUser: UserRecord;
}

function createPendingUpload(file: File): PendingUpload {
  return {
    tempId: crypto.randomUUID(),
    file,
    productName: file.name.replace(/\.pdf$/i, ''),
    manufacturer: '',
    area: '',
    notes: '',
    documentDate: ''
  };
}

export function UploadPanel({ currentUser }: UploadPanelProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasInvalidRows = useMemo(
    () =>
      pendingUploads.some(
        (item) => !item.productName.trim() || !item.documentDate || !isValidDateInput(item.documentDate)
      ),
    [pendingUploads]
  );

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    const nextFiles = Array.from(event.target.files ?? []).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (nextFiles.length === 0) {
      return;
    }

    setPendingUploads((current) => [...current, ...nextFiles.map(createPendingUpload)]);
    setMessage('');
    setError('');
    event.target.value = '';
  }

  function updatePendingUpload(tempId: string, field: keyof Omit<PendingUpload, 'tempId' | 'file'>, value: string): void {
    setPendingUploads((current) =>
      current.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  }

  function removePendingUpload(tempId: string): void {
    setPendingUploads((current) => current.filter((item) => item.tempId !== tempId));
  }

  async function saveUploads(): Promise<void> {
    if (pendingUploads.length === 0 || hasInvalidRows) {
      setError('Revise que todas las hojas tengan producto y fecha del documento valida.');
      return;
    }

    setIsSaving(true);
    setError('');
    const now = new Date().toISOString();

    await db.sheets.bulkAdd(
      pendingUploads.map((item) => ({
        id: crypto.randomUUID(),
        productName: item.productName.trim(),
        manufacturer: item.manufacturer.trim(),
        area: item.area.trim(),
        notes: item.notes.trim(),
        documentDate: item.documentDate,
        expirationDate: calculateExpirationFromDocumentDate(item.documentDate),
        uploadDate: now,
        uploadedById: currentUser.id,
        uploadedByName: currentUser.fullName,
        fileName: item.file.name,
        pdfBlob: item.file,
        pdfSize: item.file.size,
        createdAt: now,
        updatedAt: now
      }))
    );

    setPendingUploads([]);
    setMessage(`Se almacenaron ${pendingUploads.length} hoja(s) de seguridad.`);
    setIsSaving(false);
  }

  return (
    <section className="panel-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Carga documental</p>
          <h2>Subir PDF individual o masivo</h2>
        </div>
        <label className="upload-trigger">
          Seleccionar PDF
          <input type="file" accept="application/pdf" multiple onChange={handleFilesSelected} />
        </label>
      </div>

      <p className="section-copy">
        Seleccione uno o varios PDF. Antes de guardar complete la fecha del documento; la aplicacion calcula el vencimiento automaticamente a {SHEET_VALIDITY_YEARS} anos.
      </p>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {pendingUploads.length === 0 ? (
        <div className="empty-state compact-empty">No hay archivos pendientes de carga.</div>
      ) : (
        <div className="pending-grid">
          {pendingUploads.map((item) => (
            <article className="pending-card" key={item.tempId}>
              <div className="pending-topline">
                <strong>{item.file.name}</strong>
                <button className="ghost-button" type="button" onClick={() => removePendingUpload(item.tempId)}>
                  Quitar
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Producto
                  <input
                    value={item.productName}
                    onChange={(event) => updatePendingUpload(item.tempId, 'productName', event.target.value)}
                    required
                  />
                </label>

                <label>
                  Fabricante
                  <input
                    value={item.manufacturer}
                    onChange={(event) => updatePendingUpload(item.tempId, 'manufacturer', event.target.value)}
                  />
                </label>

                <label>
                  Area
                  <input
                    value={item.area}
                    onChange={(event) => updatePendingUpload(item.tempId, 'area', event.target.value)}
                  />
                </label>

                <label>
                  Fecha del documento (base de alerta)
                  <input
                    type="date"
                    value={item.documentDate}
                    onChange={(event) => updatePendingUpload(item.tempId, 'documentDate', event.target.value)}
                    required
                  />
                </label>
              </div>

              {item.documentDate && isValidDateInput(item.documentDate) ? (() => {
                const projectedExpiration = calculateExpirationFromDocumentDate(item.documentDate);
                const remainingDays = daysUntilExpiration(projectedExpiration);
                return (
                  <p className="muted-text">
                    Vencimiento calculado: {projectedExpiration}. Estado proyectado:{' '}
                    {getStatusLabel(getSheetStatus(projectedExpiration))}.{' '}
                    {remainingDays < 0
                      ? `Vencida hace ${Math.abs(remainingDays)} dia(s).`
                      : `Vence en ${remainingDays} dia(s).`}
                  </p>
                );
              })() : null}

              <label>
                Observaciones
                <textarea
                  rows={3}
                  value={item.notes}
                  onChange={(event) => updatePendingUpload(item.tempId, 'notes', event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
      )}

      <div className="actions-row">
        <button
          className="primary-button"
          type="button"
          disabled={pendingUploads.length === 0 || hasInvalidRows || isSaving}
          onClick={() => void saveUploads()}
        >
          {isSaving ? 'Guardando...' : 'Guardar carga'}
        </button>
        {hasInvalidRows ? (
          <span className="muted-text">Complete producto y fecha del documento valida en todos los registros.</span>
        ) : null}
      </div>
    </section>
  );
}