import { AIParseResult, TransactionType, AIConfig } from '../types';

// ============================================================================
// 1. 配置与辅助工具
// ============================================================================

// --- Configuration Loader ---
const getDeepSeekConfig = (): AIConfig => {
  try {
    const stored = localStorage.getItem('zenledger_ai_config');
    if (stored) {
      const config = JSON.parse(stored);
      if (config.provider === 'DEEPSEEK') {
        return config;
      }
    }
  } catch (e) {
    console.warn("Failed to load DeepSeek config", e);
  }
  // 默认回退配置
  return {
    provider: 'DEEPSEEK',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat'
  };
};

// --- Schema Definitions ---
// 这是核心：定义我们期望 AI 返回的严格格式
const parseSchema = {
  type: 'object',
  properties: {
    amount: { type: 'number', description: "The numeric value. MUST be a number (e.g. 20.5), NOT a string. Remove currency symbols." },
    currency: { type: 'string', description: "Currency code, e.g., CNY." },
    category: { type: 'string', description: "Category: 餐饮, 交通, 购物, 日用, 娱乐, etc." },
    date: { type: 'string', description: "YYYY-MM-DD format." },
    description: { type: 'string', description: "Brief description of the transaction." },
    merchant: { type: 'string', description: "Merchant name." },
    type: { 
      type: 'string', 
      enum: [TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER],
      description: "EXPENSE, INCOME, or TRANSFER"
    },
    accountName: { type: 'string', description: "Payment method: WeChat, Alipay, Bank Card, Cash, etc." }
  },
  required: ["amount", "description", "type", "date"],
};

// --- Helper: Robust JSON Extractor ---
// 即使 AI 返回了 markdown 或废话，也能提取出合法的 JSON
const extractJSON = (text: string): any => {
    if (!text) throw new Error("AI returned empty response");
    
    let clean = text.trim();
    // 1. 去除 Markdown 代码块标记
    clean = clean.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. 寻找最外层的 {}
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Failed. Raw text:", text);
        throw new Error("AI response was not valid JSON.");
    }
};

// --- Helper: Time Extractor ---
const extractTime = (txt: string): string | null => {
  const m = txt.match(/(\d{1,2})[:：点\.](\d{1,2})/);
  if (!m) return null;
  const h = parseInt(m[1]).toString().padStart(2, '0');
  const min = parseInt(m[2]).toString().padStart(2, '0');
  return `${h}:${min}`;
};

// ============================================================================
// 2. 核心 API 调用函数
// ============================================================================

const generateContent = async (
  systemPrompt: string, 
  userPrompt: string,
  configOverride?: AIConfig,
  jsonMode: boolean = true // 新增参数：控制是否强制 JSON 模式
): Promise<string | null> => {
  const config = configOverride || getDeepSeekConfig();
  
  if (!config.apiKey) {
    throw new Error("DeepSeek API Key is missing. Please configure it in Settings.");
  }

  let baseUrl = config.baseUrl || 'https://api.deepseek.com';
  baseUrl = baseUrl.replace(/\/$/, "");
  
  // 智能路径补全
  if (!baseUrl.includes("/v1") && !baseUrl.includes("/chat")) {
     baseUrl += "/chat/completions";
  } else if (baseUrl.endsWith("/v1")) {
     baseUrl += "/chat/completions";
  }

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'deepseek-chat',
        messages: messages,
        stream: false,
        // 如果是记账解析，温度低一点(准确)；如果是写周报，温度高一点(创意)
        temperature: jsonMode ? 0.1 : 0.7, 
        // ✅ 关键：强制 JSON 模式 (DeepSeek V2.5/V3 支持)
        response_format: jsonMode ? { type: "json_object" } : undefined 
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) throw new Error("401 Unauthorized: Check API Key");
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;

  } catch (error) {
    console.error("DeepSeek API Error:", error);
    throw error;
  }
};

// ============================================================================
// 3. 导出服务 (Business Logic)
// ============================================================================

/**
 * 核心功能：解析普通文本 (包含 OCR 文本)
 */
export const parseTransactionText = async (
  text: string, 
  language: 'en' | 'zh' = 'en'
): Promise<AIParseResult | null> => {
  
  // 1. 将 Schema 转为字符串，注入 Prompt
  const schemaStr = JSON.stringify(parseSchema, null, 2);
  
  const langInstruction = language === 'zh' 
    ? "Return 'category', 'description', 'merchant' in Simplified Chinese." 
    : "Return fields in English.";
  
  // 2. 构造 System Prompt，包含 Schema 和 强制规则
  const systemPrompt = `You are a financial data parser.
  
RULES:
1. You MUST output strict JSON.
2. The JSON structure MUST match this schema:
${schemaStr}

3. 'amount' field MUST be a pure number. REMOVE '¥', '$', or ',' symbols.
4. If date is missing, use ${new Date().toISOString().split('T')[0]}.
5. 'type' must be: EXPENSE, INCOME, or TRANSFER.

${langInstruction}`;

  try {
    console.log("[DeepSeek] Analyzing text:", text);
    // 强制开启 JSON 模式
    const jsonText = await generateContent(systemPrompt, text, undefined, true);
    
    if (!jsonText) return null;
    
    // 3. 解析与提取
    const parsed = extractJSON(jsonText) as AIParseResult;

    // 4. 后处理：补全时间信息
    const timeHint = extractTime(text);
    const baseDate = parsed.date.includes('T') ? parsed.date.split('T')[0] : parsed.date;
    
    if (timeHint) {
      parsed.date = `${baseDate}T${timeHint}:00`;
    } else {
      parsed.date = `${baseDate}T00:00:00`;
    }

    return parsed;
  } catch (error) {
    console.error("DeepSeek parse error:", error);
    return null; // 让上层 UI 处理空结果
  }
};

/**
 * 兼容旧代码的 OCR 解析入口 (实际逻辑与 parseTransactionText 相同)
 */
export const parseOCRText = async (
  ocrText: string,
  language: 'en' | 'zh' = 'zh'
): Promise<AIParseResult | null> => {
    return parseTransactionText(ocrText, language);
};

/**
 * 生成财务周报/月报 (Markdown 模式)
 */
export const generateFinancialReport = async (
  prompt: string, 
  language: 'en' | 'zh'
): Promise<string | null> => {
  const chineseSystemInstruction = `你是 "Pocket Ledger AI"，一位温暖、共情且专业的财务教练。
**Tone:** 友善、鼓励。强调风险与改进空间。
**Format:** Markdown + Emoji
**Content:**
1. 💀 **致命一击 (The Roast):** 一句犀利的评价。
2. 📊 **账单解剖:** 分析最大支出。
3. 🛡️ **避坑指南:** 一个可操作的建议。`;

  const englishSystemInstruction = `You are "Pocket Ledger AI", a warm, empathic financial coach.
**Tone:** Friendly, encouraging, professional.
**Format:** Markdown + Emoji
**Content:**
1. 💀 **The Roast:** A savage comment.
2. 📊 **The Reality:** Analysis.
3. 🛡️ **The Advice:** Actionable tip.`;

  const systemInstruction = language === 'zh' ? chineseSystemInstruction : englishSystemInstruction;

  try {
    // ⚠️ 注意：这里 jsonMode = false，因为我们需要 Markdown 文本
    const text = await generateContent(systemInstruction, prompt, undefined, false);
    return text || "No analysis generated.";
  } catch (error) {
    console.error("DeepSeek report error:", error);
    return null;
  }
};

/**
 * 测试连接
 */
export const testDeepSeekConnection = async (config: AIConfig): Promise<string> => {
  // 测试时强制 JSON 模式，确保 API Key 和 JSON Mode 都正常工作
  const res = await generateContent(
      "You are a test bot. Reply with JSON: {\"reply\": \"Pong\"}", 
      "Ping", 
      config, 
      true
  );
  return res || "Pong";
};

// 占位符：兼容 geminiService 的图片接口 (DeepSeek 纯文本模式不支持图片流)
export const parseTransactionImage = async () => { return null; } 
export const parseTransactionImageWithGemini = async () => { return null; }