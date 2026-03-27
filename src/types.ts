export type UserRole = 'admin' | 'uploader';

export interface UserRecord {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface SafetySheetRecord {
  id: string;
  productName: string;
  manufacturer: string;
  area: string;
  notes: string;
  documentDate: string;
  expirationDate: string;
  uploadDate: string;
  uploadedById: string;
  uploadedByName: string;
  fileName: string;
  pdfBlob: Blob;
  pdfSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingUpload {
  tempId: string;
  file: File;
  productName: string;
  manufacturer: string;
  area: string;
  notes: string;
  documentDate: string;
}

export type SheetStatus = 'vigente' | 'por-vencer' | 'vencida';