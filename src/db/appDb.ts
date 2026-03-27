import Dexie, { type Table } from 'dexie';
import type { SafetySheetRecord, UserRecord } from '../types';
import { calculateDocumentDateFromExpiration } from '../utils/date';

class SafetySheetsDatabase extends Dexie {
  users!: Table<UserRecord, string>;
  sheets!: Table<SafetySheetRecord, string>;

  constructor() {
    super('safety-sheets-db');

    this.version(1).stores({
      users: 'id, username, role, createdAt',
      sheets: 'id, productName, manufacturer, expirationDate, uploadDate, uploadedById, createdAt'
    });

    this.version(2)
      .stores({
        users: 'id, username, role, createdAt',
        sheets: 'id, productName, manufacturer, documentDate, expirationDate, uploadDate, uploadedById, createdAt'
      })
      .upgrade((transaction) =>
        transaction
          .table('sheets')
          .toCollection()
          .modify((sheet) => {
            if (!sheet.documentDate && sheet.expirationDate) {
              sheet.documentDate = calculateDocumentDateFromExpiration(sheet.expirationDate);
            }
          })
      );
  }
}

export const db = new SafetySheetsDatabase();