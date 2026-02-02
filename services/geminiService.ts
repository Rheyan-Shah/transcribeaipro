
import { GoogleGenAI, Type } from "@google/genai";

export const summarizeTranscript = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are an expert secretary. Analyze the following transcript and provide a professional structured JSON response. 
    Transcript: ${text}`,
    config: {
      systemInstruction: "You transform raw meeting transcripts into high-quality executive summaries. Be concise, professional, and highlight actionable items clearly.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "A high-level 2-3 sentence overview of the discussion." },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of the most important insights or topics discussed."
          },
          actionItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Concrete next steps or tasks assigned during the session."
          }
        },
        required: ["summary", "keyPoints", "actionItems"]
      }
    }
  });
  
  const textOutput = response.text;
  if (!textOutput) return null;
  
  try {
    return JSON.parse(textOutput);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON", e);
    return null;
  }
};
