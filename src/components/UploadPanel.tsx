import { ChangeEvent, useMemo, useState } from 'react';
import { saveUploadsInDataLayer } from '../cloud/dataLayer';
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

  const invalidUploads = useMemo(
    () =>
      pendingUploads
        .map((item, index) => {
          const reasons: string[] = [];

          if (!item.productName.trim()) {
            reasons.push('producto');
          }

          if (!item.documentDate) {
            reasons.push('fecha del documento');
          } else if (!isValidDateInput(item.documentDate)) {
            reasons.push('fecha del documento valida');
          }

          return reasons.length > 0
            ? {
                index,
                fileName: item.file.name,
                reasons
              }
            : null;
        })
        .filter((item): item is { index: number; fileName: string; reasons: string[] } => item !== null),
    [pendingUploads]
  );

  const hasInvalidRows = invalidUploads.length > 0;

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
    if (pendingUploads.length === 0) {
      setError('No hay archivos pendientes por guardar.');
      return;
    }

    if (hasInvalidRows) {
      const examples = invalidUploads
        .slice(0, 3)
        .map((item) => `${item.index + 1}. ${item.fileName}: ${item.reasons.join(', ')}`)
        .join(' | ');
      const extraCount = invalidUploads.length - 3;
      const extraMessage = extraCount > 0 ? ` | y ${extraCount} registro(s) mas.` : '';

      setError(`Complete los campos obligatorios antes de guardar. ${examples}${extraMessage}`);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const savedCount = await saveUploadsInDataLayer(pendingUploads, currentUser);
      setPendingUploads([]);
      setMessage(`Se almacenaron ${savedCount} hoja(s) de seguridad.`);
    } catch (exception) {
      const details = exception instanceof Error ? exception.message : 'Error desconocido.';
      setError(details);
    } finally {
      setIsSaving(false);
    }
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
          {pendingUploads.map((item) => {
            const missingProduct = !item.productName.trim();
            const invalidDocumentDate = !item.documentDate || !isValidDateInput(item.documentDate);

            return (
            <article
              className={`pending-card${missingProduct || invalidDocumentDate ? ' pending-card-invalid' : ''}`}
              key={item.tempId}
            >
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
                    aria-invalid={missingProduct}
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
                    aria-invalid={invalidDocumentDate}
                    required
                  />
                </label>
              </div>

              {missingProduct || invalidDocumentDate ? (
                <p className="form-error">
                  {missingProduct ? 'Complete el producto.' : ''}
                  {missingProduct && invalidDocumentDate ? ' ' : ''}
                  {invalidDocumentDate ? 'Ingrese una fecha del documento valida.' : ''}
                </p>
              ) : null}

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
            );
          })}
        </div>
      )}

      <div className="actions-row">
        <button
          className="primary-button"
          type="button"
          disabled={pendingUploads.length === 0 || isSaving}
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