
import { GoogleGenAI } from "@google/genai";
import { PartCategory } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function suggestPartDescription(category: PartCategory, name: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `身為零件管理專家，針對分類「${category}」中的零件「${name}」，提供一段專業的技術規格描述建議（30字以內），以及兩個常見的檢核重點。`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini suggestion failed:", error);
    return "暫時無法取得 AI 建議。";
  }
}

export async function analyzeInventory(records: any[]) {
  try {
    const dataSummary = records.map(r => `${r.category}: ${r.name} (${r.quantity}${r.unit})`).join(', ');
    const response = await ai.models.generateContent({
      // FIX: Use gemini-3-pro-preview for complex reasoning and data analysis tasks
      model: 'gemini-3-pro-preview',
      contents: `以下是目前的零件庫存摘要：${dataSummary}。請針對庫存多樣性、可能的缺損風險或管理優化提出三點建議。`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "分析資料時發生錯誤。";
  }
}
