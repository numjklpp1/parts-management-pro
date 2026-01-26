
import { PartRecord, PartCategory } from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class GoogleSheetsService {
  private accessToken: string;
  private spreadsheetId: string;

  constructor(accessToken: string, spreadsheetId: string) {
    this.accessToken = accessToken;
    this.spreadsheetId = spreadsheetId;
  }

  async initializeSheet(): Promise<void> {
    const headers = [
      'ID', '時間', '類別', '名稱', '規格', '數量', '備註'
    ];
    
    try {
      await fetch(`${SHEETS_API_BASE}/${this.spreadsheetId}/values/Sheet1!A1:G1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headers],
        }),
      });
    } catch (error) {
      console.error('Failed to initialize sheet:', error);
    }
  }

  async addRecord(record: PartRecord): Promise<void> {
    const row = [
      record.id,
      record.timestamp,
      record.category,
      record.name,
      record.specification,
      record.quantity,
      record.note
    ];

    const response = await fetch(
      `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save to Google Sheets');
    }
  }

  async fetchRecords(): Promise<PartRecord[]> {
    const response = await fetch(
      `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Sheet1!A2:G1000`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Google Sheets');
    }

    const data = await response.json();
    if (!data.values) return [];

    return data.values.map((row: any[]) => ({
      id: row[0],
      timestamp: row[1],
      category: row[2] as PartCategory,
      name: row[3],
      specification: row[4],
      quantity: Number(row[5]),
      note: row[6] || '',
    }));
  }
}
