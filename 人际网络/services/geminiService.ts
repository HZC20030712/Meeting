import { GoogleGenAI, Type } from "@google/genai";
import { GeminiAnalysis } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateProfileInsights = async (
  name: string,
  role: string,
  company: string,
  context: string
): Promise<GeminiAnalysis | null> => {
  if (!apiKey) {
    console.warn("Gemini API Key not found");
    return null;
  }

  try {
    const model = 'gemini-3-flash-preview';
    const prompt = `
      分析以下专业人士的档案：姓名 ${name}，职位 ${role}，公司 ${company}。
      当前背景/会议目的：${context}。
      
      请生成：
      1. 三个破冰话题（分为：Professional-专业, Interest-兴趣, Dynamic-动态）。
      2. 一条简短、策略性的“会议建议” (nudge)，用于指导如何与此人沟通。
      
      请直接返回 JSON 格式数据，不要包含 Markdown 格式标记。所有内容请使用中文。
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            icebreakers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['Professional', 'Interest', 'Dynamic'] },
                  text: { type: Type.STRING },
                  iconType: { type: Type.STRING, enum: ['book', 'star', 'zap'] }
                }
              }
            },
            nudge: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiAnalysis;
    }
    return null;

  } catch (error) {
    console.error("Error generating insights:", error);
    return null;
  }
};