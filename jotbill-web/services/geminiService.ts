import { GoogleGenAI, Type } from "@google/genai";
import { AIParseResult, TransactionType, AIConfig } from '../types';
import { DEFAULT_AI_CONFIG } from '../constants';

// --- CONFIGURATION HELPER ---
const getAIConfig = (): AIConfig => {
  try {
    const stored = localStorage.getItem('zenledger_ai_config');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load AI config", e);
  }
  return DEFAULT_AI_CONFIG;
};

// --- SCHEMA DEFINITIONS ---
const parseSchema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "The numeric value of the transaction. MUST be a pure number, no currency symbols." },
    currency: { type: Type.STRING, description: "Currency code, e.g., USD, EUR, CNY." },
    category: { type: Type.STRING, description: "A short category name derived from context." },
    date: { type: Type.STRING, description: "ISO 8601 date string (YYYY-MM-DD). If not specified, use today." },
    description: { type: Type.STRING, description: "A brief description of what was purchased or the income source." },
    merchant: { type: Type.STRING, description: "The name of the merchant or payee." },
    type: { 
      type: Type.STRING, 
      enum: [TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER],
      description: "Whether it is an expense or income." 
    },
    accountName: { type: Type.STRING, description: "The name of the payment method or account used (e.g. 'WeChat', 'Bank Card', 'Cash')." }
  },
  required: ["amount", "description", "type", "date"],
};

// --- CORE GENERATION FUNCTION ---
const generateContent = async (
  systemPrompt: string, 
  userPrompt: string | { parts: any[] },
  schema?: any,
  configOverride?: AIConfig // Added support for testing unsaved configs
): Promise<string | null> => {
  const config = configOverride || getAIConfig();
  
  if (!config.apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  // === BRANCH A: Google Gemini (Native Schema Support) ===
  if (config.provider === 'GEMINI') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    try {
      const response = await ai.models.generateContent({
        model: config.model || 'gemini-1.5-flash',
        contents: typeof userPrompt === 'string' 
          ? `${systemPrompt}\n\nUser Input: ${userPrompt}`
          : { 
              parts: [
                { text: systemPrompt }, 
                ...userPrompt.parts
              ] 
            },
        config: {
          responseMimeType: schema ? "application/json" : "text/plain",
          responseSchema: schema,
        }
      });
      return response.text || null;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  } 
  
  // === BRANCH B: DeepSeek / OpenAI / Custom (Manual Schema Injection) ===
  else {
    let baseUrl = config.baseUrl || (config.provider === 'DEEPSEEK' ? '[https://api.deepseek.com](https://api.deepseek.com)' : '');
    
    // Normalize URL: Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");
    
    // Auto-append path if missing for common providers
    if (config.provider === 'DEEPSEEK') {
         if (!baseUrl.includes("/v1/")) {
             baseUrl += "/v1/chat/completions";
         } else if (!baseUrl.includes("/chat/completions")) {
             baseUrl = baseUrl.trimEnd('/') + "/chat/completions";
         }
    } else if (config.provider === 'CUSTOM' && !baseUrl.includes('/chat/completions')) {
         if (!baseUrl.includes('/v1') && !baseUrl.includes("/chat")) {
             baseUrl += '/v1/chat/completions';
         } else if (baseUrl.endsWith('/v1')) {
             baseUrl += '/chat/completions';
         }
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: typeof userPrompt === 'string' ? userPrompt : "Image input not fully supported in text-only generic mode." }
    ];

    // Handle Image for OpenAI/DeepSeek (Text-only fallback or Vision if needed)
    if (typeof userPrompt !== 'string' && userPrompt.parts) {
         // Attempt to convert parts to OpenAI Vision format
         const contentParts = userPrompt.parts.map((p: any) => {
             if (p.text) return { type: "text", text: p.text };
             if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
             return null;
         }).filter(Boolean);
         messages[1].content = contentParts;
    }

    // ✅ [关键修复] 手动注入 Schema 到 System Prompt
    // DeepSeek 等模型不一定原生支持 strict schema mode，所以通过 Prompt 告诉它结构
    if (schema) {
        const schemaStr = JSON.stringify(schema, null, 2);
        messages[0].content += `
        
IMPORTANT OUTPUT RULES:
1. You MUST return strictly valid JSON.
2. Do NOT wrap the JSON in markdown code blocks (like \`\`\`json).
3. The JSON must strictly follow this Schema definition:
${schemaStr}

4. FIELD RULES:
   - "amount": Must be a pure number. REMOVE all currency symbols (￥, $, etc.) and commas.
   - "date": Use YYYY-MM-DD format.
`;
    }

    // DeepSeek reasoner 对 response_format 兼容性差，出现 400 时去掉该字段
    const allowJsonFormat = schema && !(config.provider === 'DEEPSEEK' && (config.model || '').toLowerCase().includes('reasoner'));

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages,
          stream: false,
          // Add json_object mode if supported by provider, DeepSeek V3 supports it
          response_format: allowJsonFormat ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) throw new Error("401 Unauthorized: Invalid API Key.");
        throw new Error(`API Request Failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      return text || null;

    } catch (error) {
      console.error("Custom/DeepSeek API Error:", error);
      throw error;
    }
  }
};


// --- EXPORTED SERVICES ---

// 简易时间抽取：支持 “10:00” / “10点” / “下午3点半” / “早上8点20” 等
const extractTime = (txt: string): string | null => {
  const amWords = ['上午', '早上', '凌晨', '清晨', 'am', 'a.m'];
  const pmWords = ['下午', '傍晚', '晚上', '晚间', 'pm', 'p.m', '中午'];
  const lower = txt.toLowerCase();
  const hasAM = amWords.some(w => txt.includes(w) || lower.includes(w));
  const hasPM = pmWords.some(w => txt.includes(w) || lower.includes(w));

  const m = txt.match(/(\d{1,2})(?:[:：点\.](\d{1,2}))?(?:分)?(?:半)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  let min = m[2] ? parseInt(m[2], 10) : 0;
  const hasHalf = /半/.test(m[0]);
  if (hasHalf && !m[2]) min = 30;
  if (hasPM && h < 12) h += 12;
  if (hasAM && h === 12) h = 0;
  if (h >= 24 || min >= 60) return null;
  const hh = h.toString().padStart(2, '0');
  const mm = min.toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

export const parseTransactionText = async (text: string, language: 'en' | 'zh' = 'en'): Promise<AIParseResult | null> => {
  const langInstruction = language === 'zh' 
    ? "Return the 'category', 'description', and 'merchant' fields in Simplified Chinese." 
    : "Return fields in English.";
  
  const systemPrompt = `You are a financial parsing assistant. Parse the provided transaction text into the structured JSON object defined in the schema. 
      If the date is missing, assume it is ${new Date().toISOString().split('T')[0]}.
      Try to identify the payment account name if mentioned (e.g., 'WeChat', 'Alipay', 'Credit Card').
      ${langInstruction}`;

  try {
    const jsonText = await generateContent(systemPrompt, text, parseSchema);
    if (!jsonText) return null;
    
    // Clean up potential markdown code blocks (even if instructed not to use them)
    // 移除 markdown 标记以及可能的前后空白
    let cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 某些模型可能会在 JSON 前后加杂质，尝试找到第一个 { 和最后一个 }
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanJson) as AIParseResult;

    // 如果缺少时间，尝试从原始文本抽取；或为日期补上时间
    const timeHint = extractTime(text);
    const baseDate = parsed.date && parsed.date.split('T')[0] ? parsed.date.split('T')[0] : new Date().toISOString().split('T')[0];
    if (timeHint) {
        parsed.date = `${baseDate}T${timeHint}:00`;
    } else if (parsed.date && !parsed.date.includes('T')) {
        // 仅有日期，补 00:00
        parsed.date = `${parsed.date}T00:00:00`;
    }

    return parsed;
  } catch (error) {
    console.error("Parse Text Error:", error);
    // 不再弹窗 alert，而是静默失败返回 null，让 UI 层处理 Toast
    return null;
  }
};

export const parseTransactionImage = async (base64Image: string): Promise<AIParseResult[] | null> => {
  const systemPrompt = "Extract all financial transactions from this image. Return a JSON array. Identify the merchant, date, amount, type (EXPENSE/INCOME), and infer a category. If the text in the image is Chinese, return category/description/merchant in Chinese.";
  
  // Format for "parts" used in Gemini branch, Generic branch will attempt to convert
  const userContent = {
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
      { text: "Parse this receipt." }
    ]
  };

  try {
    const jsonText = await generateContent(systemPrompt, userContent, { type: Type.ARRAY, items: parseSchema });
    if (!jsonText) return null;
    
    let cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = cleanJson.indexOf('[');
    const lastBracket = cleanJson.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
        cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
    }

    return JSON.parse(cleanJson) as AIParseResult[];
  } catch (error) {
    console.error("Parse Image Error:", error);
    return null;
  }
};

/**
 * Fallback: always use Gemini Vision to parse image (bypass provider setting).
 * Useful when provider is DeepSeek but device lacks native OCR.
 */
export const parseTransactionImageWithGemini = async (
  base64Image: string,
  apiKeyOverride?: string
): Promise<AIParseResult[] | null> => {
  const config = getAIConfig();
  const apiKey = apiKeyOverride || config.apiKey;
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = "Extract all financial transactions from this image. Return a JSON array. Identify the merchant, date, amount, type (EXPENSE/INCOME), and infer a category. If the text in the image is Chinese, return category/description/merchant in Chinese.";
  const userContent = {
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
      { text: "Parse this receipt." }
    ]
  };

  try {
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-1.5-flash',
      contents: { parts: [{ text: systemPrompt }, ...userContent.parts] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: parseSchema },
      }
    });
    const jsonText = response.text || null;
    if (!jsonText) return null;
    const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as AIParseResult[];
  } catch (error) {
    console.error("Gemini Vision fallback error:", error);
    throw error;
  }
};

export const generateFinancialReport = async (prompt: string, language: 'en' | 'zh'): Promise<string | null> => {
  const englishSystemInstruction = `
  **Role:** You are "Pocket Ledger AI", a warm, empathic, and data-driven financial coach.
  **Tone:** Friendly, encouraging, and professional. You highlight risks/waste and give clear next-step actions, not sarcasm.
  **Language:** English.
  **Output Format:** Markdown with Emojis.
**Content:**
1. 💀 **The Roast:** A one-sentence savage comment on their spending.
2. 📊 **The Reality:** Briefly analyze top spending categories.
3. 🛡️ **The Advice:** One actionable, sarcastic tip for next month.
`;

  const chineseSystemInstruction = `
  **Role:** 你是 "Pocket Ledger AI" (口袋账本AI)，一位温暖、共情且数据驱动的财务教练。
  **Tone:** 友善、鼓励、专业。强调风险/浪费与改进空间，给出清晰的下一步行动，而不是讽刺。
  **Language:** Chinese (Simplified).
  **Output Format:** Markdown with Emojis.
**Content:**
1. 💀 **致命一击 (The Roast):** 用一句话犀利地评价他们的消费行为。
2. 📊 **账单解剖 (The Reality):** 简要分析花费最多的类别。
3. 🛡️ **避坑指南 (The Advice):** 给出一个可操作的、带有讽刺意味的建议。
`;

  const systemInstruction = language === 'zh' ? chineseSystemInstruction : englishSystemInstruction;

  try {
    const text = await generateContent(systemInstruction, prompt);
    return text || "No analysis generated.";
  } catch (error) {
    console.error(error);
    return null; // Silent fail
  }
};

/**
 * Tests the AI configuration by sending a minimal request.
 * Throws an error if the connection fails.
 */
export const testAIConnection = async (config: AIConfig): Promise<string> => {
  const systemPrompt = "You are a test assistant. Reply with 'Pong'.";
  const userPrompt = "Ping";
  
  // Reuse generateContent but with specific config override
  // We don't use schema to keep it simple and compatible with all providers for a ping test
  const response = await generateContent(systemPrompt, userPrompt, undefined, config);
  
  if (!response) {
    throw new Error("Empty response from AI Provider");
  }
  return response;
};