
import { PartRecord, PartCategory } from '../types';

// 改為呼叫內部的 API Proxy，由後端處理 Service Account 認證
const PROXY_API_ENDPOINT = '/api/inventory';

export class GoogleSheetsService {
  private spreadsheetId: string;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * 初始化試算表（透過 Proxy）
   */
  async initializeSheet(): Promise<void> {
    try {
      const response = await fetch(`${PROXY_API_ENDPOINT}?action=initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: this.spreadsheetId }),
      });
      if (!response.ok) throw new Error('Initialization failed');
    } catch (error) {
      console.error('Failed to initialize sheet via proxy:', error);
    }
  }

  /**
   * 新增紀錄（透過 Proxy）
   */
  async addRecord(record: PartRecord): Promise<void> {
    const response = await fetch(PROXY_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: this.spreadsheetId,
        record: record
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `同步失敗 (HTTP ${response.status})`);
    }
  }

  /**
   * 抓取所有紀錄（透過 Proxy）
   */
  async fetchRecords(): Promise<PartRecord[]> {
    const response = await fetch(`${PROXY_API_ENDPOINT}?spreadsheetId=${this.spreadsheetId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '無法從雲端獲取資料');
    }

    const data = await response.json();
    return data.records || [];
  }
}
