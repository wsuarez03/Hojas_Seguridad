import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/appDb';
import { defaultAdminCredentials } from '../db/seed';
import type { PendingUpload, SafetySheetRecord, UserRecord, UserRole } from '../types';
import { hashPassword, normalizeUsername } from '../utils/auth';
import { calculateExpirationFromDocumentDate } from '../utils/date';

interface CloudUserRow {
  id: string;
  full_name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

interface CloudSheetRow {
  id: string;
  product_name: string;
  manufacturer: string;
  area: string;
  notes: string;
  document_date: string;
  expiration_date: string;
  upload_date: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  file_name: string;
  pdf_base64: string;
  pdf_mime: string;
  pdf_size: number;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USERS_TABLE = 'hds_users';
const SHEETS_TABLE = 'hds_sheets';

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

export function isCloudSyncEnabled(): boolean {
  return Boolean(supabase);
}

function ensureCloudClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('La sincronizacion centralizada no esta configurada.');
  }

  return supabase;
}

function userFromCloud(row: CloudUserRow): UserRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

function userToCloud(user: UserRecord): CloudUserRow {
  return {
    id: user.id,
    full_name: user.fullName,
    username: user.username,
    password_hash: user.passwordHash,
    role: user.role,
    created_at: user.createdAt
  };
}

function sheetFromCloud(row: CloudSheetRow): SafetySheetRecord {
  return {
    id: row.id,
    productName: row.product_name,
    manufacturer: row.manufacturer,
    area: row.area,
    notes: row.notes,
    documentDate: row.document_date,
    expirationDate: row.expiration_date,
    uploadDate: row.upload_date,
    uploadedById: row.uploaded_by_id,
    uploadedByName: row.uploaded_by_name,
    fileName: row.file_name,
    pdfBlob: base64ToBlob(row.pdf_base64, row.pdf_mime),
    pdfSize: row.pdf_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function sheetToCloud(sheet: SafetySheetRecord): Promise<CloudSheetRow> {
  return {
    id: sheet.id,
    product_name: sheet.productName,
    manufacturer: sheet.manufacturer,
    area: sheet.area,
    notes: sheet.notes,
    document_date: sheet.documentDate,
    expiration_date: sheet.expirationDate,
    upload_date: sheet.uploadDate,
    uploaded_by_id: sheet.uploadedById,
    uploaded_by_name: sheet.uploadedByName,
    file_name: sheet.fileName,
    pdf_base64: await blobToBase64(sheet.pdfBlob),
    pdf_mime: sheet.pdfBlob.type || 'application/pdf',
    pdf_size: sheet.pdfSize,
    created_at: sheet.createdAt,
    updated_at: sheet.updatedAt
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('No fue posible codificar el archivo PDF.'));
        return;
      }

      const separatorIndex = result.indexOf(',');
      resolve(separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('No fue posible leer el archivo PDF.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || 'application/pdf' });
}

async function fetchCloudUsers(): Promise<UserRecord[]> {
  const cloud = ensureCloudClient();
  const { data, error } = await cloud.from(USERS_TABLE).select('*').order('created_at', { ascending: true });

  if (error) {
    throw new Error(`No fue posible consultar usuarios centralizados: ${error.message}`);
  }

  return (data as CloudUserRow[]).map(userFromCloud);
}

async function fetchCloudSheets(): Promise<SafetySheetRecord[]> {
  const cloud = ensureCloudClient();
  const { data, error } = await cloud
    .from(SHEETS_TABLE)
    .select('*')
    .order('expiration_date', { ascending: true });

  if (error) {
    throw new Error(`No fue posible consultar hojas centralizadas: ${error.message}`);
  }

  return (data as CloudSheetRow[]).map(sheetFromCloud);
}

export async function bootstrapCloudAdminIfNeeded(): Promise<void> {
  if (!isCloudSyncEnabled()) {
    return;
  }

  const cloudUsers = await fetchCloudUsers();

  if (cloudUsers.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const username = normalizeUsername(defaultAdminCredentials.username);
  const admin: UserRecord = {
    id: crypto.randomUUID(),
    fullName: 'Administrador principal',
    username,
    passwordHash: await hashPassword(username, defaultAdminCredentials.password),
    role: 'admin',
    createdAt: now
  };

  const cloud = ensureCloudClient();
  const { error } = await cloud.from(USERS_TABLE).upsert(userToCloud(admin), { onConflict: 'id' });

  if (error) {
    throw new Error(`No fue posible inicializar el administrador en la nube: ${error.message}`);
  }
}

export async function syncCloudToLocalCache(): Promise<void> {
  if (!isCloudSyncEnabled()) {
    return;
  }

  const [users, sheets] = await Promise.all([fetchCloudUsers(), fetchCloudSheets()]);

  await db.transaction('rw', db.users, db.sheets, async () => {
    await db.users.clear();
    await db.sheets.clear();

    if (users.length > 0) {
      await db.users.bulkPut(users);
    }

    if (sheets.length > 0) {
      await db.sheets.bulkPut(sheets);
    }
  });
}

export async function migrateLocalToCloud(): Promise<void> {
  if (!isCloudSyncEnabled()) {
    return;
  }

  // Evita ejecutar migración múltiples veces
  const migrationKey = 'local_to_cloud_migration_done';
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const allLocalSheets = await db.sheets.toArray();

  if (allLocalSheets.length === 0) {
    localStorage.setItem(migrationKey, 'true');
    return;
  }

  const cloud = ensureCloudClient();
  const cloudRows = await Promise.all(allLocalSheets.map((sheet) => sheetToCloud(sheet)));

  const { error } = await cloud.from(SHEETS_TABLE).upsert(cloudRows, { onConflict: 'id' });

  if (error) {
    console.error('Error al migrar datos locales a nube:', error.message);
    throw new Error(`No fue posible migrar hojas locales a la nube: ${error.message}`);
  }

  localStorage.setItem(migrationKey, 'true');
}

export async function createUserInDataLayer(payload: {
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}): Promise<UserRecord> {
  const user: UserRecord = {
    id: crypto.randomUUID(),
    fullName: payload.fullName,
    username: normalizeUsername(payload.username),
    passwordHash: payload.passwordHash,
    role: payload.role,
    createdAt: new Date().toISOString()
  };

  if (isCloudSyncEnabled()) {
    const cloud = ensureCloudClient();
    const { error } = await cloud.from(USERS_TABLE).upsert(userToCloud(user), { onConflict: 'id' });

    if (error) {
      throw new Error(`No fue posible crear usuario en la nube: ${error.message}`);
    }
  }

  await db.users.put(user);
  return user;
}

export async function deleteUserInDataLayer(userId: string): Promise<void> {
  if (isCloudSyncEnabled()) {
    const cloud = ensureCloudClient();
    const { error } = await cloud.from(USERS_TABLE).delete().eq('id', userId);

    if (error) {
      throw new Error(`No fue posible eliminar usuario en la nube: ${error.message}`);
    }
  }

  await db.users.delete(userId);
}

export async function saveUploadsInDataLayer(
  pendingUploads: PendingUpload[],
  currentUser: UserRecord
): Promise<number> {
  const now = new Date().toISOString();
  const sheets: SafetySheetRecord[] = pendingUploads.map((item) => ({
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
  }));

  if (isCloudSyncEnabled()) {
    const cloud = ensureCloudClient();
    const cloudRows = await Promise.all(sheets.map((sheet) => sheetToCloud(sheet)));
    const { error } = await cloud.from(SHEETS_TABLE).upsert(cloudRows, { onConflict: 'id' });

    if (error) {
      throw new Error(`No fue posible guardar hojas en la nube: ${error.message}`);
    }
  }

  await db.sheets.bulkPut(sheets);
  return sheets.length;
}

export async function deleteSheetInDataLayer(sheetId: string): Promise<void> {
  if (isCloudSyncEnabled()) {
    const cloud = ensureCloudClient();
    const { error } = await cloud.from(SHEETS_TABLE).delete().eq('id', sheetId);

    if (error) {
      throw new Error(`No fue posible eliminar la hoja en la nube: ${error.message}`);
    }
  }

  await db.sheets.delete(sheetId);
}