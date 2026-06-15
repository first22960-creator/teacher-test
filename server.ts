import express from "express";
import path from "path";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
          'User-Agent': 'aistudio-build',
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

// API Endpoint: Use AI to parse raw text into structured quiz questions with robust retry & fallback handling
app.post("/api/gemini/parse-questions", async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return res.status(400).json({ error: "กรุณาส่งข้อความข้อสอบดิบสำหรับการประมวลผล" });
    }

    const systemInstruction = 
      "คุณคือผู้เชี่ยวชาญด้านการออกข้อสอบและการศึกษาที่มุ่งเน้นความเร็วและการสรุปประเด็นสูงสุด " +
      "หน้าที่ของคุณคือการแปลงเนื้อหาดิบที่ถูกส่งมา (ชีทสรุป, ข้อมูลดิบ, หรือข้อสอบเก่าที่ฟอร์แมตกระจัดกระจาย) " +
      "ให้กลายเป็นข้อสอบปรนัย (Multiple-choice) 4 ตัวเลือกภาษาไทยที่มีคุณภาพสูง โดยแต่ละข้อต้องประกอบด้วย:\n" +
      "1. คำถามสำคัญ (text) สั้นกระชับตรงประเด็น ไม่เยิ่นเย้อ\n" +
      "2. ตัวเลือก 4 ตัวเลือก (options) ที่สั้น กระชับ แม่นยำ\n" +
      "3. ดัชนีข้อเฉลยที่ถูกต้อง (correctIndex) เป็นเลข 0-3\n" +
      "4. คำอธิบายเฉลย (explanation) สั้นกระชับที่สุด ไม่เกิน 1 ประโยคเด็ดขาด (ห้ามยาวเกิน 15 คำ) เพื่อประหยัดระยะเวลาประมวลผลและลดเวลาดาวน์โหลด\n" +
      "ห้ามสร้างข้อมูลเท็จเด็ดขาด และห้ามคิดวิเคราะห์นอกเรื่องจนทำงานช้า";

    const prompt = `ช่วยแปลงเนื้อหาเหล่านี้ให้เป็นข้อสอบชุดประเมินผลภาษาไทยที่มี 4 ตัวเลือกตามโครงสร้าง JSON:
[
  {
    "text": "ข้อคำถาม...",
    "options": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3", "ตัวเลือกที่ 4"],
    "correctIndex": 0,
    "explanation": "คำอธิบายสั้นสุดๆ ไม่เกิน 1 ประโยคเด็ดขาด"
  }
]

สำคัญมากเพื่อความรวดเร็วสูงสุด: เฉลยและดัชนีต้องถูกต้อง 100% แต่คำอธิบาย (explanation) ต้องสั้น กระชับ แบน และรวดเร็วที่สุด ห้ามเขียนยาวบรรยายทฤษฎียืดยาวเด็ดขาด!

เนื้อหาดิบที่ต้องการให้แปลง:
${rawText}`;

    // Highly optimized fast models context: Try gemini-3.5-flash first, and fallback to the ultra-fast gemini-3.1-flash-lite.
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let lastError: any = null;
    let parsedQuestions: any[] | undefined = undefined;

    for (const modelName of modelsToTry) {
      // 1 attempt per model is enough to support extremely fast failover
      for (let attempt = 1; attempt <= 1; attempt++) {
        try {
          console.log(`[Gemini Request] Attempting parsing using rapid model: ${modelName}`);
          
          // Disable any thinking delay and enforce JSON output
          const config: any = {
            systemInstruction,
            temperature: 0.1, // low temperature for precise factual formatting
            responseMimeType: "application/json",
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL // Absolute zero thinking overhead for maximum extraction speed
            },
            responseSchema: questionsResponseSchema // Always use structured output schema for perfect parsing
          };

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
              console.log(`[Gemini Success] Successfully generated and parsed ${parsed.length} questions using ${modelName}`);
              break;
            } else {
              throw new Error("โครงสร้างผลลัพธ์จาก AI ไม่เป็นอาร์เรย์ของข้อสอบที่ถูกต้อง");
            }
          }
        } catch (err: any) {
          lastError = err;
          const messageStr = err?.message || String(err);
          console.log(`[Gemini Status] Model ${modelName} is temporarily busy or failed. Details: ${messageStr.slice(0, 150)}`);
        }
      }
      
      // If we successfully parsed, stop trying other models
      if (parsedQuestions) {
        break;
      }
    }

    if (!parsedQuestions) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`AI ทั้งหมดอยู่ในสภาวะทำงานหนักชั่วคราว: ${errMsg}`);
    }

    return res.json({ questions: parsedQuestions });

  } catch (error: any) {
    console.error("Gemini Parse Error:", error);
    return res.status(500).json({ 
      error: "เกิดข้อผิดพลาดในการประมวลผลข้อสอบด้วย AI", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Configure Vite integration and start full-stack web application server
async function launchServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    // Use Vite development server middleware in development mode
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static UI bundle built inside dist/ for production runtime
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start full-stack web application server binding on all interfaces and hardcoded port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${isProduction ? 'production' : 'development'} mode on port ${PORT}`);
  });
}

launchServer().catch((err) => {
  console.error("Failed to bootstrap full-stack server:", err);
});
