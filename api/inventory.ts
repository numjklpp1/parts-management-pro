
import { google } from 'googleapis';

export const config = {
  api: {
    bodyParser: true,
  },
};

// 設定零件與儲存格的對照表 (Cell Mapping)
// 格式為：[組別][零件名稱] : "分頁!儲存格"
const SUMMARY_MAPPING: Record<string, Record<string, string>> = {
  '完成': {
    '樹德4尺-L': '門!B3',
    '樹德4尺-R': '門!C3',
    '樹德3尺-L': '門!D3',
    '樹德3尺-R': '門!E3',
  },
  '框_完成': {
    '樹德4尺-L': '門!B4',
    '樹德4尺-R': '門!C4',
  }
};

export default async function handler(req: any, res: any) {
  const { method, query, body } = req;
  const spreadsheetId = query.spreadsheetId || (body && body.spreadsheetId) || process.env.spreadsheet_id;

  if (!spreadsheetId) {
    return res.status(400).json({ message: '尚未配置 Spreadsheet ID。' });
  }

  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.private_key;

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ message: '伺服器環境變數配置不完整。' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const logSheetName = '門資料庫'; 

    if (method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${logSheetName}!A2:G2000`,
      });
      const rows = response.data.values || [];
      const records = rows.map((row: any) => ({
        id: row[0] || '',
        timestamp: row[1] || '',
        category: row[2] || '',
        name: row[3] || '',
        specification: row[4] || '',
        quantity: Number(row[5]) || 0,
        note: row[6] || '',
      }));
      return res.status(200).json({ records });
    } 
    
    else if (method === 'POST') {
      const { record } = body;
      if (!record) return res.status(400).json({ message: 'No record provided' });

      // 1. 寫入流水帳 (門資料庫)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${logSheetName}!A2`,
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

      // 2. 檢查是否有對應的彙整儲存格需要更新
      const targetCell = SUMMARY_MAPPING[record.specification]?.[record.name];
      
      if (targetCell) {
        try {
          // A. 讀取該儲存格目前的數值
          const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: targetCell,
          });
          
          const currentValue = Number(getRes.data.values?.[0]?.[0]) || 0;
          const newValue = currentValue + record.quantity;

          // B. 寫回更新後的數值
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: targetCell,
            valueInputOption: 'RAW',
            requestBody: {
              values: [[newValue]],
            },
          });
          
          console.log(`Updated ${targetCell}: ${currentValue} -> ${newValue}`);
        } catch (summaryErr) {
          console.error('Summary update failed:', summaryErr);
          // 彙整失敗不中斷主流程，僅記錄錯誤
        }
      }

      return res.status(200).json({ message: 'Success' });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: error.message || '發生未知錯誤' });
  }
}
