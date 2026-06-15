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

// Splits raw text into groups of around 4-5 multiple-choice questions, or smaller paragraphs if no numbering is present
function splitTextIntoBatches(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const questions: string[][] = [];
  let currentQuestion: string[] = [];

  // Question numbering indicator (e.g. "1.", "ข้อ 1", "Q1", "1)") at line start
  const questionStartRegex = /^\s*(?:[0-9]+[\.\)\-\/\s]|ข้อ\s*[0-9]+|Q[0-9]+)/i;

  for (const line of lines) {
    if (questionStartRegex.test(line) && currentQuestion.length > 0) {
      questions.push(currentQuestion);
      currentQuestion = [];
    }
    currentQuestion.push(line);
  }
  if (currentQuestion.length > 0) {
    questions.push(currentQuestion);
  }

  // If no clear question boundaries are found, chunk by paragraph groups of up to 1200 characters each
  if (questions.length <= 1) {
    const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      const batches: string[] = [];
      let currentBatch = "";
      for (const p of paragraphs) {
        if ((currentBatch + "\n\n" + p).length > 1200) {
          batches.push(currentBatch.trim());
          currentBatch = p;
        } else {
          currentBatch = currentBatch ? currentBatch + "\n\n" + p : p;
        }
      }
      if (currentBatch) {
        batches.push(currentBatch.trim());
      }
      return batches;
    }
    return [text];
  }

  // Combine questions into batches of at most 5 questions per batch for ultra-fast parallel generation
  const batches: string[] = [];
  const questionsPerBatch = 5;
  for (let i = 0; i < questions.length; i += questionsPerBatch) {
    const slice = questions.slice(i, i + questionsPerBatch);
    const batchText = slice.map(q => q.join("\n")).join("\n\n");
    batches.push(batchText);
  }

  return batches;
}

// Internal recursive parser task per batch with exponential-ish backup, linear retry across multiple models
async function parseQuestionBatchWithRetry(rawText: string, batchIndex: number, totalBatches: number): Promise<any[]> {
  const systemInstruction = 
    "คุณคือผู้เชี่ยวชาญด้านการออกข้อสอบและการศึกษาที่มุ่งเน้นความเร็วและการสรุปประเด็นสูงสุด " +
    "หน้าที่ของคุณคือการแปลงเนื้อหาดิบที่ส่งมาเป็นข้อสอบปรนัย (Multiple-choice) 4 ตัวเลือกภาษาไทยที่มีคุณภาพสูงสุด โดยแต่ละข้อประกอบด้วย:\n" +
    "1. คำถามสำคัญ (text) สั้นกระชับตรงประเด็น ไม่เยิ่นเย้อ\n" +
    "2. ตัวเลือก 4 ตัวเลือก (options) ที่สั้น กระชับ แม่นยำ\n" +
    "3. ดัชนีข้อเฉลยที่ถูกต้อง (correctIndex) เป็นเลข 0-3\n" +
    "4. คำอธิบายเฉลย (explanation) สั้นที่สุด ไม่เกิน 1 ประโยคเด็ดขาด (ห้ามเกิน 15 คำ) เพื่อลดเวลาประมวลผลดาวน์โหลดลงสูงสุด\n" +
    "ห้ามสร้างข้อมูลเท็จเด็ดขาด และยึดความจริงตามเนื้อหาแนบ";

  const prompt = `ช่วยแปลงเนื้อหาเหล่านี้ให้เป็นข้อสอบชุดประเมินผลภาษาไทยที่มี 4 ตัวเลือกตามโครงสร้าง JSON:
[
  {
    "text": "ข้อคำถาม...",
    "options": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3", "ตัวเลือกที่ 4"],
    "correctIndex": 0,
    "explanation": "คำอธิบายสั้นที่สุด ไม่เกิน 1 ประโยคเด็ดขาด"
  }
]

สำคัญมากเพื่อความรวดเร็วและประหยัดเวลาโหลด: เฉลยและดัชนีถูกต้อง 100% แต่คำอธิบาย (explanation) ต้องสั้น กระชับ แบน และรวดเร็วที่สุด ห้ามบ่นหรือโม้อธิบายทฤษฎียาวเหยียด!

ข้อความเนื้อหาดิบสำหรับการแปลง (ส่วนที่ ${batchIndex + 1} จากทั้งหมด ${totalBatches}):
${rawText}`;

  // Extensive choice of high-performance models for absolute failover capability
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Processing utilizing model: ${modelName} (Attempt ${attempt}/2)`);
        
        const config: any = {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: questionsResponseSchema
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
            console.log(`[Batch ${batchIndex + 1}/${totalBatches} Success] Successfully processed ${parsed.length} questions on ${modelName}`);
            return parsed;
          }
        }
      } catch (err: any) {
        lastError = err;
        const messageStr = err?.message || String(err);
        console.log(`[Batch ${batchIndex + 1}/${totalBatches} warning] Model ${modelName} (Attempt ${attempt}/2) failure: ${messageStr.slice(0, 150)}`);
        
        // Brief sleep jitter before retrying to let spike/503 recover
        const waitMs = attempt * 1000 + Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  throw lastError || new Error(`ไม่สามารถเชื่อมต่อปัญญาประดิษฐ์สกัดเนื้อหาพาร์ทที่ ${batchIndex + 1} ได้หลังจากลองหลายช่องทาง`);
}

// API Endpoint: Use AI to parse raw text into structured quiz questions with parallel batching & fallback handling
app.post("/api/gemini/parse-questions", async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return res.status(400).json({ error: "กรุณาส่งข้อความข้อสอบดิบสำหรับการประมวลผล" });
    }

    console.log(`[Gemini Engine] Received parsing request. Raw length: ${rawText.length} characters.`);
    const batches = splitTextIntoBatches(rawText);
    console.log(`[Gemini Engine] Partitioned into ${batches.length} parallel batches.`);

    // Run batches in parallel, but with a slight staggered delay to prevent hitting concurrent rate limits on low-tier keys
    const promises = batches.map(async (batchText, index) => {
      if (index > 0) {
        // Stagger batch startup by 1200ms per batch
        await new Promise((resolve) => setTimeout(resolve, index * 1200));
      }
      return parseQuestionBatchWithRetry(batchText, index, batches.length);
    });

    const results = await Promise.all(promises);
    const combinedQuestions = results.flat();

    console.log(`[Gemini Engine Complete] Combined and retrieved total of ${combinedQuestions.length} questions successfully!`);
    return res.json({ questions: combinedQuestions });

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
