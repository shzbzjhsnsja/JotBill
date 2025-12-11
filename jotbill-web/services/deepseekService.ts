import { AIParseResult, TransactionType, AIConfig } from '../types';

// --- CONFIGURATION HELPER ---
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
  return {
    provider: 'DEEPSEEK',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  };
};

// --- SCHEMA DEFINITIONS ---
const parseSchema = {
  type: 'object',
  properties: {
    amount: { type: 'number', description: "The numeric value of the transaction." },
    currency: { type: 'string', description: "Currency code, e.g., USD, EUR, CNY." },
    category: { type: 'string', description: "A short category name derived from context." },
    date: { type: 'string', description: "ISO 8601 date string (YYYY-MM-DD). If not specified, use today." },
    description: { type: 'string', description: "A brief description of what was purchased or the income source." },
    merchant: { type: 'string', description: "The name of the merchant or payee." },
    type: { 
      type: 'string', 
      enum: [TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER],
      description: "Whether it is an expense or income." 
    },
    accountName: { type: 'string', description: "The name of the payment method or account used (e.g. 'WeChat', 'Bank Card', 'Cash')." }
  },
  required: ["amount", "description", "type", "date"],
};

// --- CORE GENERATION FUNCTION ---
const generateContent = async (
  systemPrompt: string, 
  userPrompt: string,
  configOverride?: AIConfig
): Promise<string | null> => {
  const config = configOverride || getDeepSeekConfig();
  
  if (!config.apiKey) {
    throw new Error("DeepSeek API Key is missing. Please configure it in Settings.");
  }

  let baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
  
  // Normalize URL: Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, "");
  
  // Auto-append path if missing
  if (!baseUrl.includes("/v1/")) {
    baseUrl += "/v1";
  }
  if (!baseUrl.includes("/chat/completions")) {
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
        temperature: 0.7
      })
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("401 Unauthorized: Invalid API Key.");
      throw new Error(`API Request Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    return text || null;

  } catch (error) {
    console.error("DeepSeek API Error:", error);
    throw error;
  }
};

// --- EXPORTED SERVICES ---

/**
 * 简易时间提取：支持 "10:00" / "10点" / "下午3点半" / "早上8点20" 等
 */
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

/**
 * 使用 DeepSeek 解析文本交易信息
 */
export const parseTransactionText = async (
  text: string, 
  language: 'en' | 'zh' = 'en'
): Promise<AIParseResult | null> => {
  const langInstruction = language === 'zh' 
    ? "Return the 'category', 'description', and 'merchant' fields in Simplified Chinese." 
    : "Return fields in English.";
  
  const systemPrompt = `You are a financial parsing assistant. Parse the following transaction text into a structured JSON object. 
      If the date is missing, assume it is ${new Date().toISOString().split('T')[0]}.
      Try to identify the payment account name if mentioned (e.g., 'WeChat', 'Alipay', 'Credit Card').
      ${langInstruction}
      
      IMPORTANT: Output ONLY valid JSON without markdown code blocks or any other text.`;

  try {
    const jsonText = await generateContent(systemPrompt, text);
    if (!jsonText) return null;
    
    // Clean up potential markdown code blocks
    const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as AIParseResult;

    // 如果缺少时间，尝试从原始文本抽取
    const timeHint = extractTime(text);
    const baseDate = parsed.date && parsed.date.split('T')[0] 
      ? parsed.date.split('T')[0] 
      : new Date().toISOString().split('T')[0];
      
    if (timeHint) {
      parsed.date = `${baseDate}T${timeHint}:00`;
    } else if (parsed.date && !parsed.date.includes('T')) {
      parsed.date = `${parsed.date}T00:00:00`;
    }

    return parsed;
  } catch (error) {
    console.error("DeepSeek parse error:", error);
    return null;
  }
};

/**
 * 使用 DeepSeek 解析 OCR 文本（专用版本）
 * 专为 HarmonyOCR 识别结果优化
 */
export const parseOCRText = async (
  ocrText: string,
  language: 'en' | 'zh' = 'zh'
): Promise<AIParseResult | null> => {
  const langInstruction = language === 'zh' 
    ? "用简体中文返回 category、description 和 merchant 字段。" 
    : "Return fields in English.";
  
  const systemPrompt = `你是一个财务数据解析助手。请将以下 OCR 识别到的收据/账单文本解析为交易信息。
      
返回格式必须是有效的 JSON，包含以下字段（都是必需的）：
- amount: 金额（数字类型，例如 99.99）
- currency: 货币代码（如 CNY, USD 等）
- category: 交易类别（如 餐饮、交通、购物、电费等）
- date: 日期（ISO 8601 格式 YYYY-MM-DD，如无法从图片识别则用今天日期）
- description: 交易描述（简短说明购买内容）
- merchant: 商户名称（店铺名或支付方名称）
- type: 交易类型（只能是 EXPENSE、INCOME 或 TRANSFER 之一）
- accountName: 账户名称（支付方式，如 WeChat、Alipay、Bank Card、Cash 等）

${langInstruction}

IMPORTANT: 
1. 只返回有效的 JSON，不要包含任何 markdown 代码块或其他文本
2. 所有金额必须是数字类型，不要带符号
3. 日期必须是 YYYY-MM-DD 格式
4. type 字段只能是这三个值之一：EXPENSE、INCOME、TRANSFER`;

  try {
    const jsonText = await generateContent(systemPrompt, `请解析以下 OCR 识别的文本：\n\n${ocrText}`);
    if (!jsonText) return null;
    
    // 清理 markdown 代码块
    const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as AIParseResult;

    // 确保日期格式正确
    if (!parsed.date) {
      parsed.date = new Date().toISOString().split('T')[0];
    }
    
    if (parsed.date && !parsed.date.includes('T')) {
      parsed.date = `${parsed.date}T00:00:00`;
    }

    return parsed;
  } catch (error) {
    console.error("DeepSeek OCR parse error:", error);
    return null;
  }
};

/**
 * 使用 DeepSeek 生成财务报告
 */
export const generateFinancialReport = async (
  prompt: string, 
  language: 'en' | 'zh'
): Promise<string | null> => {
  const chineseSystemInstruction = `你是 "Pocket Ledger AI" (口袋账本 AI)，一位温暖、共情且数据驱动的财务教练。
**语气:** 友善、鼓励、专业。强调风险/浪费与改进空间，给出清晰的下一步行动。
**输出格式:** Markdown + Emoji

**内容结构:**
1. 💀 **致命一击 (The Roast):** 用一句话犀利地评价消费行为。
2. 📊 **账单解剖 (The Reality):** 简要分析花费最多的类别。
3. 🛡️ **避坑指南 (The Advice):** 给出一个可操作的建议，带有讽刺意味。`;

  const englishSystemInstruction = `You are "Pocket Ledger AI", a warm, empathic, and data-driven financial coach.
**Tone:** Friendly, encouraging, and professional. Highlight risks/waste and give clear next-step actions.
**Output Format:** Markdown with Emojis.
**Content:**
1. 💀 **The Roast:** A one-sentence savage comment on their spending.
2. 📊 **The Reality:** Briefly analyze top spending categories.
3. 🛡️ **The Advice:** One actionable, sarcastic tip for next month.`;

  const systemInstruction = language === 'zh' ? chineseSystemInstruction : englishSystemInstruction;

  try {
    const text = await generateContent(systemInstruction, prompt);
    return text || "No analysis generated.";
  } catch (error) {
    console.error("DeepSeek report error:", error);
    return null;
  }
};

/**
 * 测试 DeepSeek 连接
 */
export const testDeepSeekConnection = async (config: AIConfig): Promise<string> => {
  const systemPrompt = "You are a test assistant. Reply with 'Pong' only.";
  const userPrompt = "Ping";
  
  const response = await generateContent(systemPrompt, userPrompt, config);
  
  if (!response) {
    throw new Error("Empty response from DeepSeek");
  }
  return response;
};
