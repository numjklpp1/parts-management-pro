
import { PartRecord } from '../types';

const PROXY_API_ENDPOINT = '/api/inventory';
const LOCAL_RECORDS_KEY = 'local_inventory_records';
const LOCAL_TASKS_KEY = 'local_inventory_tasks';

export class GoogleSheetsService {
  private spreadsheetId: string;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
  }

  private isLocalMode(): boolean {
    return !this.spreadsheetId || this.spreadsheetId.trim() === '';
  }

  /**
   * 初始化試算表
   */
  async initializeSheet(): Promise<void> {
    if (this.isLocalMode()) return;
    try {
      await fetch(`${PROXY_API_ENDPOINT}?action=initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: this.spreadsheetId }),
      });
    } catch (error) {
      console.warn('Cloud sync unavailable, using local mode');
    }
  }

  /**
   * 新增紀錄
   */
  async addRecord(record: PartRecord): Promise<void> {
    if (this.isLocalMode()) {
      const records = await this.fetchRecords();
      records.push(record);
      localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
      return;
    }

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
   * 抓取所有紀錄
   */
  async fetchRecords(): Promise<PartRecord[]> {
    if (this.isLocalMode()) {
      const stored = localStorage.getItem(LOCAL_RECORDS_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    const response = await fetch(`${PROXY_API_ENDPOINT}?spreadsheetId=${this.spreadsheetId}`);
    if (!response.ok) throw new Error('無法從雲端獲取資料');
    const data = await response.json();
    return data.records || [];
  }

  /**
   * 抓取待辦任務
   */
  async fetchTasks(): Promise<string[]> {
    if (this.isLocalMode()) {
      const stored = localStorage.getItem(LOCAL_TASKS_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    const response = await fetch(`${PROXY_API_ENDPOINT}?spreadsheetId=${this.spreadsheetId}&type=tasks`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.tasks || [];
  }

  /**
   * 儲存待辦任務
   */
  async updateTasks(tasks: string[]): Promise<void> {
    if (this.isLocalMode()) {
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
      return;
    }

    await fetch(`${PROXY_API_ENDPOINT}?type=tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: this.spreadsheetId,
        tasks: tasks
      }),
    });
  }
}
