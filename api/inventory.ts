
import { google } from 'googleapis';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: any, res: any) {
  const { method, query, body } = req;
  
  // 優先權：1. Query string, 2. Body, 3. Vercel Environment Variable
  const spreadsheetId = query.spreadsheetId || (body && body.spreadsheetId) || process.env.spreadsheet_id;

  if (!spreadsheetId) {
    return res.status(400).json({ 
      message: '尚未配置 Spreadsheet ID。請在系統設定中填寫，或在 Vercel 環境變數中設定 spreadsheet_id。' 
    });
  }

  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.private_key;

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ 
        message: '伺服器環境變數配置不完整：請確認 GOOGLE_SERVICE_ACCOUNT_EMAIL 與 private_key 已正確設定。' 
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        // 處理 Vercel 貼上金鑰時可能產生的換行符號問題
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ---------------------------------------------------------
    // ⚠️ 重要：工作表名稱 (Tab Name)
    // 如果您在 Google 試算表下方改了分頁名稱，請修改下面這個變數：
    const sheetName = '門'; 
    // ---------------------------------------------------------

    if (method === 'GET') {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A2:G1000`,
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
      } catch (err: any) {
        if (err.status === 403) {
          throw new Error(`存取遭拒：請確認已將服務帳號 ${clientEmail} 加入為該試算表的「編輯者」。`);
        }
        if (err.status === 404) {
          throw new Error('找不到該試算表，請檢查 Spreadsheet ID 是否正確。');
        }
        // 如果是工作表不存在，回傳錯誤訊息讓使用者知道
        return res.status(500).json({ message: `找不到名為「${sheetName}」的分頁，請確認試算表分頁名稱是否正確。` });
      }
    } 
    
    else if (method === 'POST') {
      const { record } = body;

      // 嘗試寫入資料
      if (record) {
        try {
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
        } catch (appendErr: any) {
          throw new Error(`無法寫入資料至「${sheetName}」：${appendErr.message}`);
        }
      }
      return res.status(200).json({ message: 'No record provided' });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: error.message || '發生未知錯誤' });
  }
}
