import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/appDb';
import { useAuth } from '../hooks/useAuth';
import {
  ALERT_WINDOW_DAYS,
  daysUntilExpiration,
  formatBytes,
  formatDisplayDate,
  getSheetStatus,
  getStatusLabel,
  sortByExpiration
} from '../utils/date';
import { downloadBlob, openBlobInNewTab } from '../utils/files';
import type { SheetStatus } from '../types';

interface PublicDashboardProps {
  onOpenLogin: () => void;
}

type FilterValue = 'todos' | SheetStatus;

function getNotificationBody(productNames: string[], total: number): string {
  if (total === 1) {
    return `1 hoja requiere seguimiento: ${productNames[0]}.`;
  }

  const preview = productNames.slice(0, 2).join(', ');
  const extra = total > 2 ? ` y ${total - 2} mas` : '';
  return `${total} hojas requieren seguimiento: ${preview}${extra}.`;
}

export function PublicDashboard({ onOpenLogin }: PublicDashboardProps) {
  const { isCloudMode } = useAuth();
  const sheets = useLiveQuery(async () => sortByExpiration(await db.sheets.toArray()), [], []);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('todos');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  useEffect(() => {
    function updateStatus(): void {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const summary = useMemo(() => {
    return sheets.reduce(
      (accumulator, sheet) => {
        const status = getSheetStatus(sheet.expirationDate);
        accumulator.total += 1;
        accumulator[status] += 1;
        return accumulator;
      },
      { total: 0, vigente: 0, 'por-vencer': 0, vencida: 0 }
    );
  }, [sheets]);

  const highlightedSheets = useMemo(
    () => sheets.filter((sheet) => getSheetStatus(sheet.expirationDate) !== 'vigente').slice(0, 5),
    [sheets]
  );

  const filteredSheets = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return sheets.filter((sheet) => {
      const status = getSheetStatus(sheet.expirationDate);
      const matchesStatus = statusFilter === 'todos' || status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        sheet.productName.toLowerCase().includes(normalizedSearch) ||
        sheet.manufacturer.toLowerCase().includes(normalizedSearch) ||
        sheet.area.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [searchValue, sheets, statusFilter]);

  useEffect(() => {
    if (notificationPermission !== 'granted') {
      return;
    }

    const sheetsToAlert = sheets
      .filter((sheet) => getSheetStatus(sheet.expirationDate) !== 'vigente')
      .sort((left, right) => left.expirationDate.localeCompare(right.expirationDate));

    const pendingAlerts = sheetsToAlert.length;
    const today = new Date().toISOString().slice(0, 10);
    const signature = sheetsToAlert
      .map((sheet) => `${sheet.id}:${sheet.expirationDate}`)
      .join('|');
    const notificationKey = `hds-alert-${today}`;
    const previousSignature = localStorage.getItem(notificationKey);

    if (pendingAlerts === 0 || previousSignature === signature) {
      if (pendingAlerts === 0) {
        localStorage.removeItem(notificationKey);
      }
      return;
    }

    new Notification('Alertas de vencimiento', {
      body: getNotificationBody(
        sheetsToAlert.map((sheet) => sheet.productName),
        pendingAlerts
      )
    });
    localStorage.setItem(notificationKey, signature);
  }, [notificationPermission, sheets]);

  async function requestNotifications(): Promise<void> {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Consulta abierta</p>
          <h1>Hojas de seguridad.</h1>
          <p className="hero-text">
            La consulta publica es la pantalla inicial. Los PDF y los datos quedan guardados localmente en el navegador para operar incluso cuando no haya conectividad.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onOpenLogin}>
              Login administrador
            </button>
            <button className="secondary-button" type="button" onClick={() => void requestNotifications()}>
              Activar alertas del navegador
            </button>
          </div>
        </div>

        <div className="status-panel">
          <div className="status-badge">{isOnline ? 'Modo online' : 'Modo offline'}</div>
          <p>
            Ventana de alerta: <strong>{ALERT_WINDOW_DAYS} dias</strong>
          </p>
          <p>
            Notificaciones: <strong>{notificationPermission}</strong>
          </p>
          <p>
            Datos: <strong>{isCloudMode ? 'Sincronizados en nube' : 'Guardados solo en este equipo'}</strong>
          </p>
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card neutral">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="summary-card ok">
          <span>Vigentes</span>
          <strong>{summary.vigente}</strong>
        </article>
        <article className="summary-card warning">
          <span>Por vencer</span>
          <strong>{summary['por-vencer']}</strong>
        </article>
        <article className="summary-card danger">
          <span>Vencidas</span>
          <strong>{summary.vencida}</strong>
        </article>
      </section>

      {highlightedSheets.length > 0 ? (
        <section className="alert-strip">
          <div>
            <p className="eyebrow">Atencion</p>
            <h2>Documentos que requieren seguimiento</h2>
          </div>

          <div className="alert-list">
            {highlightedSheets.map((sheet) => {
              const remainingDays = daysUntilExpiration(sheet.expirationDate);
              const status = getSheetStatus(sheet.expirationDate);

              return (
                <article className="alert-card" key={sheet.id}>
                  <strong>{sheet.productName}</strong>
                  <span>{getStatusLabel(status)}</span>
                  <p>
                    {remainingDays < 0
                      ? `Vencio hace ${Math.abs(remainingDays)} dia(s)`
                      : `Vence en ${remainingDays} dia(s)`}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Buscador</p>
            <h2>Consultar hojas de seguridad disponibles</h2>
          </div>
        </div>

        <div className="filters-bar">
          <label>
            Buscar por producto, fabricante o area
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Ej. Acido sulfurico"
            />
          </label>

          <label>
            Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue)}>
              <option value="todos">Todos</option>
              <option value="vigente">Vigentes</option>
              <option value="por-vencer">Por vencer</option>
              <option value="vencida">Vencidas</option>
            </select>
          </label>
        </div>

        {filteredSheets.length === 0 ? (
          <div className="empty-state">No hay hojas de seguridad cargadas con los filtros actuales.</div>
        ) : (
          <div className="sheet-grid">
            {filteredSheets.map((sheet) => {
              const status = getSheetStatus(sheet.expirationDate);

              return (
                <article className="sheet-card" key={sheet.id}>
                  <div className="sheet-card-topline">
                    <div>
                      <h3>{sheet.productName}</h3>
                      <p>{sheet.manufacturer || 'Fabricante no indicado'}</p>
                    </div>
                    <span className={`status-chip ${status}`}>{getStatusLabel(status)}</span>
                  </div>

                  <dl className="detail-list">
                    <div>
                      <dt>Area</dt>
                      <dd>{sheet.area || 'No definida'}</dd>
                    </div>
                    <div>
                      <dt>Fecha documento</dt>
                      <dd>{formatDisplayDate(sheet.documentDate)}</dd>
                    </div>
                    <div>
                      <dt>Vencimiento calculado</dt>
                      <dd>{formatDisplayDate(sheet.expirationDate)}</dd>
                    </div>
                    <div>
                      <dt>Cargado por</dt>
                      <dd>{sheet.uploadedByName}</dd>
                    </div>
                    <div>
                      <dt>Tamano</dt>
                      <dd>{formatBytes(sheet.pdfSize)}</dd>
                    </div>
                  </dl>

                  {sheet.notes ? <p className="notes-box">{sheet.notes}</p> : null}

                  <div className="actions-row">
                    <button className="primary-button" type="button" onClick={() => openBlobInNewTab(sheet.pdfBlob)}>
                      Ver PDF
                    </button>
                    <button className="ghost-button" type="button" onClick={() => downloadBlob(sheet.pdfBlob, sheet.fileName)}>
                      Descargar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}