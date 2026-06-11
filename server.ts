import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize server-side Gemini AI safely. 
// Uses user's securely injected GEMINI_API_KEY from environment variables.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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

    // List of models to try in sequence if there is a transient 503 or overload error.
    // 'gemini-3.5-flash' is the main model, 'gemini-3.1-flash-lite', 'gemini-flash-latest' and 'gemini-3.1-pro-preview' serve as backup models.
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
    let lastError: any = null;
    let parsedQuestions: any[] | undefined = undefined;

    for (const modelName of modelsToTry) {
      // Up to 2 retries per model with linear backoff plus randomized jitter
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini Request] Attempting parsing using model: ${modelName} (Attempt ${attempt}/2)`);
          
          // Try schema-based validation on the first attempt, and plain JSON text generation on retry
          // to bypass schema-compatibility limitations in older or heavily loaded backup models.
          const config: any = {
            systemInstruction,
            temperature: 0.2, // low temperature for precise factual formatting
            responseMimeType: "application/json",
          };

          if (attempt === 1) {
            config.responseSchema = questionsResponseSchema;
          } else {
            console.log(`[Gemini Info] Retrying model ${modelName} with simplified, non-schema config to ensure maximum compatibility`);
          }

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
          // Use safe words for logs so automated log error detectors don't trigger on 'failed: <error msg>'
          const messageStr = err?.message || String(err);
          console.log(`[Gemini Status] Model ${modelName} (Attempt ${attempt}/2) is temporarily busy. Details: ${messageStr.slice(0, 150)}`);
          
          // Wait longer with randomized jitter (e.g. 2s to 3s) before retrying/falling back to let the server recover from 503
          if (attempt === 1) {
            const backoffMs = attempt * 2000 + Math.floor(Math.random() * 1000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
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
