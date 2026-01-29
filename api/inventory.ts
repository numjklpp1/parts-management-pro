
import { google } from 'googleapis';

export const config = {
  api: {
    bodyParser: true,
  },
};

const SUMMARY_MAPPING: Record<string, Record<string, string>> = {
  '完成': {
    '樹德4尺-L': '門!B3',
    '樹德4尺-R': '門!C3',
    '樹德3尺-L': '門!D3',
    '樹德3尺-E': '門!E3',
  },
  '框_製作完成': {
    '樹德4尺-L': '門!B4',
    '樹德4尺-R': '門!C4',
  }
};

export default async function handler(req: any, res: any) {
  const { method, query, body } = req;
  const spreadsheetId = query.spreadsheetId || (body && body.spreadsheetId) || process.env.spreadsheet_id;
  const type = query.type;

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
    const logSheetName = '玻璃門庫存資料庫'; 
    const taskSheetName = '玻璃門待辦資料庫';

    if (method === 'GET') {
      if (type === 'tasks') {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${taskSheetName}!A1:A100`,
          });
          const rows = response.data.values || [];
          const tasks = rows.map((r: any) => r[0]).filter(Boolean);
          return res.status(200).json({ tasks });
        } catch (e) {
          return res.status(200).json({ tasks: [] });
        }
      } else {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${logSheetName}!A2:G5000`,
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
    } 
    
    else if (method === 'POST') {
      if (type === 'tasks') {
        const { tasks } = body;
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${taskSheetName}!A1:A100`,
        });
        if (tasks && tasks.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${taskSheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: tasks.map((t: string) => [t]),
            },
          });
        }
        return res.status(200).json({ message: 'Tasks updated' });
      } else {
        const { record } = body;
        if (!record) return res.status(400).json({ message: 'No record provided' });

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

        const targetCell = SUMMARY_MAPPING[record.specification]?.[record.name];
        if (targetCell) {
          try {
            const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: targetCell });
            const currentValue = Number(getRes.data.values?.[0]?.[0]) || 0;
            const newValue = currentValue + record.quantity;
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: targetCell,
              valueInputOption: 'RAW',
              requestBody: { values: [[newValue]] },
            });
          } catch (summaryErr) {
            console.error('Summary update failed:', summaryErr);
          }
        }
        return res.status(200).json({ message: 'Success' });
      }
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: error.message || '發生未知錯誤' });
  }
}
