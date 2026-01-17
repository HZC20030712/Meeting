import { GeminiAnalysis } from "../types";

export const generateProfileInsights = async (
  name: string,
  role: string,
  company: string,
  context: string
): Promise<GeminiAnalysis | null> => {
  try {
    const response = await fetch('/api/social/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, company, context })
    });

    if (response.ok) {
      return await response.json() as GeminiAnalysis;
    }
    return null;
  } catch (error) {
    console.error("Error generating insights:", error);
    return null;
  }
};
