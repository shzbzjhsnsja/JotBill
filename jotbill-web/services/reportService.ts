
import * as db from './db';
import { Transaction, Category, TransactionType } from '../types';
import { generateFinancialReport } from './geminiService';

/**
 * Generates a monthly financial report using AI.
 * 
 * @param year The year (e.g., 2023)
 * @param month The month (0-11, where 0 is January)
 * @param language The language code ('en' or 'zh')
 * @param exchangeRates The current exchange rates (Record<string, number>)
 * @returns A markdown string containing the AI analysis.
 */
export const generateMonthlyReport = async (year: number, month: number, language: 'en' | 'zh', exchangeRates: Record<string, number>): Promise<string> => {
  // 1. Data Retrieval
  const [transactions, categories] = await Promise.all([
    db.getAll<Transaction>(db.STORES.TRANSACTIONS),
    db.getAll<Category>(db.STORES.CATEGORIES)
  ]);

  const noTxMsg = language === 'zh' 
    ? "数据库里没有交易记录。先去花点钱，我才能吐槽你。" 
    : "No transactions found in the database. Go spend some money first so I can roast you.";
    
  if (!transactions || transactions.length === 0) {
      return noTxMsg;
  }

  // Filter for the specific month and year (Expenses only)
  const targetTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month && t.type === TransactionType.EXPENSE;
  });

  const noExpMsg = language === 'zh'
    ? "本月没有支出记录。你是忘了吃饭，还是在藏私房钱？"
    : "No expenses found this month. Did you forget to eat, or are you just hiding your receipts?";

  if (targetTxs.length === 0) {
      return noExpMsg;
  }

  // 2. Data Aggregation (Local Calculation)
  let totalExpense = 0;
  let regretSpending = 0;
  let forexLoss = 0;
  const categoryMap: Record<string, number> = {};
  let biggestTx: Transaction | null = null;

  // Helper to find category name
  const getCategoryName = (id: string) => {
      const cat = categories.find(c => c.id === id);
      if (cat) return cat.name;
      // Search sub-categories
      for (const c of categories) {
          if (c.subCategories) {
              const sub = c.subCategories.find(s => s.id === id);
              if (sub) return sub.name;
          }
      }
      return 'Uncategorized';
  };

  targetTxs.forEach(tx => {
    totalExpense += tx.amount;

    // Category grouping
    const catName = getCategoryName(tx.categoryId);
    categoryMap[catName] = (categoryMap[catName] || 0) + tx.amount;

    // Mood Stats
    if (tx.mood === 'regret' || tx.mood === '😭') {
        regretSpending += tx.amount;
    }

    // Forex Loss/Gain Calculation
    if (tx.original_currency && tx.original_currency !== 'CNY' && tx.exchange_rate) {
       // Calculation assuming Base is CNY now for real-time rates
       const ledgerBase = exchangeRates['CNY'] || 1; 
       const originBase = exchangeRates[tx.original_currency] || 1;
       
       if (originBase > 0) {
           // Calculate theoretical current rate: 1 OriginCurrency = X LedgerBaseCurrency(CNY)
           // Rate = (1 / OriginRate) * LedgerRate
           const currentRateCNY = (1 / originBase) * ledgerBase;
           
           // tx.exchange_rate is the booked rate
           const diffPerUnit = tx.exchange_rate - currentRateCNY;
           const impact = diffPerUnit * (tx.original_amount || 0);
           forexLoss += impact;
       }
    }

    // Biggest Transaction
    if (!biggestTx || tx.amount > biggestTx.amount) {
        biggestTx = tx;
    }
  });

  // Calculate Top 3 Categories
  const topCategories = Object.entries(categoryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, amount]) => ({
          name,
          amount,
          percent: totalExpense > 0 ? `${((amount / totalExpense) * 100).toFixed(0)}%` : '0%'
      }));

  // 3. Construct JSON Payload
  const payload = {
      period: `${year}-${month + 1}`,
      total_expense: totalExpense,
      top_3_categories: topCategories,
      mood_stats: {
          regret_count: targetTxs.filter(t => t.mood === 'regret' || t.mood === '😭').length,
          regret_amount: regretSpending
      },
      currency_loss: forexLoss,
      biggest_transaction: biggestTx ? {
          item: biggestTx.merchant || biggestTx.description,
          amount: biggestTx.amount,
          date: biggestTx.date
      } : null
  };

  // 4. Create Prompt with JSON
  const prompt = `
  Analyze the following monthly financial data and provide a response based on your persona.
  
  JSON Data:
  ${JSON.stringify(payload, null, 2)}
  `;

  // 5. API Call
  const report = await generateFinancialReport(prompt, language);
  return report || (language === 'zh' ? "生成报告失败。AI都无语了。" : "Failed to generate report. Even the AI is speechless.");
};
