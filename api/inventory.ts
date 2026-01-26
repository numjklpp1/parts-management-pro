
import { google } from 'googleapis';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: any, res: any) {
  const { method, query, body } = req;
  const spreadsheetId = query.spreadsheetId || body.spreadsheetId || process.env.spreadsheet_id;

  if (!spreadsheetId) {
    return res.status(400).json({ message: '尚未配置 Spreadsheet ID。請檢查 Vercel 環境變數或系統設定。' });
  }

  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.private_key;

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ message: '伺服器配置錯誤：缺少 GOOGLE_SERVICE_ACCOUNT_EMAIL 或 private_key 環境變數。' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = 'PartInventory';

    // 輔助函式：確保分頁與標題列存在
    const ensureSheetExists = async () => {
      try {
        await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A1:G1` });
      } catch (err: any) {
        // 如果錯誤是因為找不到工作表 (400)，嘗試建立它
        if (err.status === 400) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title: sheetName } } }]
              }
            });
            // 寫入標題列
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A1:G1`,
              valueInputOption: 'RAW',
              requestBody: { values: [['ID', '時間', '分類', '項目名稱', '規格說明', '數量', '備註']] },
            });
          } catch (createErr: any) {
             console.error('Sheet creation failed:', createErr);
          }
        }
      }
    };

    if (method === 'GET') {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A2:G1000`,
        });

        const rows = response.data.values || [];
        const records = rows.map((row: any) => ({
          id: row[0],
          timestamp: row[1],
          category: row[2],
          name: row[3],
          specification: row[4],
          quantity: Number(row[5]) || 0,
          note: row[6] || '',
        }));

        return res.status(200).json({ records });
      } catch (err: any) {
        // 如果是權限問題 (403)，直接丟出讓外層捕捉
        if (err.status === 403) throw new Error(`權限不足：請確認已將 ${clientEmail} 加入試算表編輯者。`);
        // 否則視為空表
        return res.status(200).json({ records: [] });
      }
    } 
    
    else if (method === 'POST') {
      const { record } = body;
      await ensureSheetExists();

      if (record) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A2`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              record.id,
              record.timestamp,
              record.category,
              record.name,
              record.specification,
              record.quantity,
              record.note
            ]],
          },
        });
        return res.status(200).json({ message: 'Success' });
      }
      return res.status(200).json({ message: 'Initialized' });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error Details:', error);
    // 回傳具體的錯誤訊息給前端
    const msg = error.message || '連線至 Google Sheets 時發生未知錯誤';
    return res.status(500).json({ message: msg });
  }
}
