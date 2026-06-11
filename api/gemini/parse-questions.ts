import { GoogleGenAI, Type } from "@google/genai";

// Initialize server-side Gemini AI safely with lazy initialization to prevent crashes when the API key is missing.
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("ระบบไม่พบรหัสคีย์เพื่อใช้งาน AI (Missing GEMINI_API_KEY)");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-vercel',
        }
      }
    });
  }
  return aiInstance;
}

// JSON parsing schema for Gemini AI exam question extractor
const questionSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "The main text of the exam question/quiz question in Thai. Make it clear and grammatically correct."
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 4 multiple-choice options (choices) for the question in Thai, numbered or styled nicely."
    },
    correctIndex: {
      type: Type.INTEGER,
      description: "The 0-based integer index of the correct answer inside the options array (0, 1, 2, or 3)."
    },
    explanation: {
      type: Type.STRING,
      description: "A concise, informative explanation of why this choice is the correct answer in Thai."
    }
  },
  required: ["text", "options", "correctIndex", "explanation"]
};

const questionsResponseSchema = {
  type: Type.ARRAY,
  items: questionSchema,
  description: "A list of parsed multiple-choice quiz questions extracted from the raw user text."
};

// Helper function to safely clean and parse JSON that might be wrapped in Markdown code blocks
function cleanAndParseJSON(raw: string) {
  let cleaned = raw.trim();
  // Remove markdown JSON code block formatting if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json|JSON)?\n/, "");
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3).trim();
    }
  }
  return JSON.parse(cleaned);
}

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return res.status(400).json({ error: "กรุณาส่งข้อความข้อสอบดิบสำหรับการประมวลผล" });
    }

    const systemInstruction = 
      "คุณคือผู้เชี่ยวชาญด้านการออกข้อสอบและการศึกษา " +
      "หน้าที่ของคุณคือการแปลงเนื้อหาดิบทราถูกคัดลอกมา (เช่น ชีทสรุป, ตำราเรียน, ข้อมูลดิบ หรือข้อสอบเก่าที่ฟอร์แมตกระจัดกระจาย) " +
      "ให้กลายเป็นข้อสอบปรนัย (Multiple-choice) 4 ตัวเลือกภาษาไทยที่มีคุณภาพสูง โดยแต่ละข้อต้องมีคำถามที่ชัดเจน, " +
      "ตัวเลือกที่เหมาะสม 4 ตัวเลือก, ดัชนีข้อที่ถูกต้อง (0-based correctIndex) และคำอธิบายความรู้สั้นๆ ที่ถูกต้องและเข้าใจง่าย " +
      "ห้ามสร้างข้อมูลเท็จเด็ดขาด และตรวจสอบให้แน่ใจว่าได้ดัชนีข้อที่ถูกต้องตรงกับเนื้อหา";

    const prompt = `ช่วยแปลงเนื้อหาเหล่านี้ให้เป็นข้อสอบชุดประเมินผลภาษาไทยที่มี 4 ตัวเลือกตามโครงสร้าง JSON:
[
  {
    "text": "ข้อคำถาม...",
    "options": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3", "ตัวเลือกที่ 4"],
    "correctIndex": 0,
    "explanation": "คำอธิบายเฉลย..."
  }
]

เนื้อหาดิบที่ต้องการให้แปลง:
${rawText}`;

    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
    let lastError: any = null;
    let parsedQuestions: any[] | undefined = undefined;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini Vercel] Attempting parsing using model: ${modelName} (Attempt ${attempt}/2)`);
          
          const config: any = {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
          };

          if (attempt === 1) {
            config.responseSchema = questionsResponseSchema;
          }

          const ai = getGeminiClient();
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config
          });

          if (response && response.text) {
            const parsed = cleanAndParseJSON(response.text);
            if (parsed && Array.isArray(parsed) && parsed.length > 0) {
              parsedQuestions = parsed;
              break;
            } else {
              throw new Error("โครงสร้างผลลัพธ์จาก AI ไม่เป็นอาร์เรย์ของข้อสอบที่ถูกต้อง");
            }
          }
        } catch (err: any) {
          lastError = err;
          const messageStr = err?.message || String(err);
          console.log(`[Gemini Vercel] Model ${modelName} (Attempt ${attempt}/2) is temporarily busy. Details: ${messageStr.slice(0, 150)}`);
          
          if (attempt === 1) {
            const backoffMs = attempt * 2000 + Math.floor(Math.random() * 1000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }
      
      if (parsedQuestions) {
        break;
      }
    }

    if (!parsedQuestions) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`AI ทั้งหมดอยู่ในสภาวะทำงานหนักชั่วคราว: ${errMsg}`);
    }

    return res.status(200).json({ questions: parsedQuestions });

  } catch (error: any) {
    console.error("Vercel Parse Error:", error);
    return res.status(500).json({ 
      error: "เกิดข้อผิดพลาดในการประมวลผลข้อสอบด้วย AI (Vercel Serverless)", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
