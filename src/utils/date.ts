import type { SafetySheetRecord, SheetStatus } from '../types';

export const ALERT_WINDOW_DAYS = 30;
export const SHEET_VALIDITY_YEARS = 5;

export function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function daysUntilExpiration(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(`${value}T00:00:00`);
  expiration.setHours(0, 0, 0, 0);

  return Math.round((expiration.getTime() - today.getTime()) / 86_400_000);
}

export function getSheetStatus(expirationDate: string): SheetStatus {
  const remainingDays = daysUntilExpiration(expirationDate);

  if (remainingDays < 0) {
    return 'vencida';
  }

  if (remainingDays <= ALERT_WINDOW_DAYS) {
    return 'por-vencer';
  }

  return 'vigente';
}

export function getStatusLabel(status: SheetStatus): string {
  if (status === 'por-vencer') {
    return 'Por vencer';
  }

  if (status === 'vencida') {
    return 'Vencida';
  }

  return 'Vigente';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sortByExpiration(items: SafetySheetRecord[]): SafetySheetRecord[] {
  return [...items].sort((left, right) => left.expirationDate.localeCompare(right.expirationDate));
}

export function isValidDateInput(value: string): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function calculateExpirationFromDocumentDate(documentDate: string): string {
  const [year, month, day] = documentDate.split('-').map(Number);
  const expiration = new Date(Date.UTC(year + SHEET_VALIDITY_YEARS, month - 1, day));
  return expiration.toISOString().slice(0, 10);
}

export function calculateDocumentDateFromExpiration(expirationDate: string): string {
  const [year, month, day] = expirationDate.split('-').map(Number);
  const documentDate = new Date(Date.UTC(year - SHEET_VALIDITY_YEARS, month - 1, day));
  return documentDate.toISOString().slice(0, 10);
}