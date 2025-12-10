
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
}

export type Language = 'en' | 'zh' | 'fr';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'CASH' | 'INVESTMENT' | 'ALIPAY' | 'WECHAT' | 'HUABEI' | 'DEBT' | 'RECEIVABLE';

export type AIProvider = 'GEMINI' | 'DEEPSEEK' | 'CUSTOM';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface UserProfile {
  name: string;
  avatar: string; // URL or emoji
  language: Language;
}

export interface UIPreferences {
  showReports: boolean;
  showAccounts: boolean;
}

export interface Ledger {
  id: string;
  name: string;
  currency: string;
  color: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  ledgerId: string;
  accountId: string;
  amount: number;
  currency: string;
  categoryId: string; // Changed from category string to ID lookup
  date: string; // ISO Date string
  description: string;
  merchant?: string;
  type: TransactionType;
  installmentCurrent?: number; // e.g. 1
  installmentTotal?: number; // e.g. 12
  installmentFee?: number; // Interest or Service Fee for the installment
  installmentStatus?: 'ACTIVE' | 'EARLY_REPAID' | 'COMPLETED'; // New status field
  
  // New fields for Version 6
  mood?: string; // 'happy', 'regret', 'neutral', 'money'
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
}

export interface Account {
  id: string;
  ledgerId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  icon?: string;
  isExcluded?: boolean; // If true, exclude from net worth
  
  // Credit / Debt specific fields
  creditLimit?: number;      // For Credit Cards / Huabei
  statementDay?: number;     // Day of month bill is generated (1-31)
  paymentDueDay?: number;    // Day of month payment is due (1-31)
  interestRate?: number;     // Annual Interest Rate % for Debts
  dueDate?: string;          // Specific due date for loans/debts (ISO String)
}

export interface StorageConfig {
  type: 'LOCAL' | 'ICLOUD' | 'NAS' | 'SERVER';
  status: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING';
  path?: string;
  host?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  autoSync?: boolean; // New field for auto-sync setting
  allowInsecure?: boolean; // Allow self-signed certs on Android native WebDAV
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: TransactionType;
  subCategories?: Category[]; // Added sub-categories
}

export interface AIParseResult {
  amount: number;
  currency: string;
  category: string;
  date: string;
  description: string;
  merchant: string;
  type: TransactionType;
  accountName?: string; // Added for account recognition
}
