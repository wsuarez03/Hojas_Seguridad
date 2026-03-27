import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteSheetInDataLayer } from '../cloud/dataLayer';
import { db } from '../db/appDb';
import { useAuth } from '../hooks/useAuth';
import { UploadPanel } from './UploadPanel';
import { UserManagement } from './UserManagement';
import { daysUntilExpiration, formatBytes, formatDisplayDate, getSheetStatus, getStatusLabel, sortByExpiration } from '../utils/date';
import { downloadBlob, openBlobInNewTab } from '../utils/files';

export function AdminDashboard() {
  const { currentUser, isCloudMode, logout, refreshCurrentUser } = useAuth();
  const sheets = useLiveQuery(async () => sortByExpiration(await db.sheets.toArray()), [], []);
  const users = useLiveQuery(async () => db.users.toArray(), [], []);

  if (!currentUser) {
    return <></>;
  }

  const expiringSheets = sheets.filter((sheet) => getSheetStatus(sheet.expirationDate) !== 'vigente').slice(0, 6);

  async function deleteSheet(sheetId: string): Promise<void> {
    const confirmed = window.confirm('Eliminar esta hoja de seguridad?');

    if (!confirmed) {
      return;
    }

    await deleteSheetInDataLayer(sheetId);
  }

  return (
    <main className="app-shell">
      <section className="hero-panel admin-hero">
        <div className="hero-copy">
          <p className="eyebrow">Panel interno</p>
          <h1>Gestion de hojas de seguridad y usuarios</h1>
          <p className="hero-text">
            Desde aqui puede cargar PDF, revisar vencimientos y administrar usuarios de cargue si el perfil es administrador.
          </p>
        </div>

        <div className="status-panel">
          <p>
            Sesion: <strong>{currentUser.fullName}</strong>
          </p>
          <p>
            Rol: <strong>{currentUser.role === 'admin' ? 'Administrador' : 'Cargue'}</strong>
          </p>
          <p>
            Modo de datos: <strong>{isCloudMode ? 'Centralizado' : 'Solo local'}</strong>
          </p>
          <div className="stacked-actions">
            <Link className="secondary-button link-button" to="/">
              Volver a consulta
            </Link>
            <button className="ghost-button" type="button" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </section>

      <UploadPanel currentUser={currentUser} />

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2>Alertas de vencimiento</h2>
          </div>
        </div>

        {expiringSheets.length === 0 ? (
          <div className="empty-state compact-empty">No hay documentos vencidos o proximos a vencer.</div>
        ) : (
          <div className="alert-list">
            {expiringSheets.map((sheet) => {
              const status = getSheetStatus(sheet.expirationDate);
              const remainingDays = daysUntilExpiration(sheet.expirationDate);
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
        )}
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Repositorio</p>
            <h2>Documentos cargados</h2>
          </div>
        </div>

        {sheets.length === 0 ? (
          <div className="empty-state">Todavia no hay hojas de seguridad almacenadas.</div>
        ) : (
          <div className="sheet-grid compact-grid">
            {sheets.map((sheet) => {
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
                      <dt>Fecha documento</dt>
                      <dd>{formatDisplayDate(sheet.documentDate)}</dd>
                    </div>
                    <div>
                      <dt>Vencimiento calculado</dt>
                      <dd>{formatDisplayDate(sheet.expirationDate)}</dd>
                    </div>
                    <div>
                      <dt>Archivo</dt>
                      <dd>{sheet.fileName}</dd>
                    </div>
                    <div>
                      <dt>Tamano</dt>
                      <dd>{formatBytes(sheet.pdfSize)}</dd>
                    </div>
                    <div>
                      <dt>Cargado por</dt>
                      <dd>{sheet.uploadedByName}</dd>
                    </div>
                  </dl>

                  <div className="actions-row">
                    <button className="primary-button" type="button" onClick={() => openBlobInNewTab(sheet.pdfBlob)}>
                      Ver PDF
                    </button>
                    <button className="ghost-button" type="button" onClick={() => downloadBlob(sheet.pdfBlob, sheet.fileName)}>
                      Descargar
                    </button>
                    {currentUser.role === 'admin' ? (
                      <button className="danger-button" type="button" onClick={() => void deleteSheet(sheet.id)}>
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {currentUser.role === 'admin' && users ? (
        <UserManagement currentUser={currentUser} users={users} onUsersChanged={refreshCurrentUser} />
      ) : null}
    </main>
  );
}