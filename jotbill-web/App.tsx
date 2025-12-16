
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileNavbar from './components/MobileNavbar';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionModal from './components/TransactionModal';
import SettingsPage from './components/SettingsPage';
import LedgerList from './components/LedgerList';
import Reports from './components/Reports';
import AccountsPage from './components/AccountsPage';
import AccountDetail from './components/AccountDetail';
import AccountFormModal from './components/AccountFormModal';
import { Account, Transaction, AIParseResult, UserProfile, Ledger, Category, TransactionType, AccountType, UIPreferences } from './types';
import { INITIAL_ACCOUNTS, INITIAL_USER, INITIAL_LEDGERS, INITIAL_CATEGORIES, I18N, DEFAULT_UI_PREFS } from './constants';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import * as db from './services/db';
import { fetchExchangeRates } from './services/currencyService';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewStack, setViewStack] = useState<string[]>([]);
  
  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isLedgerListOpen, setIsLedgerListOpen] = useState(false); // FIXED: Added state control
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Account Modals & State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);

  // Import Confirmation State
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);

  // Data State
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [currentLedgerId, setCurrentLedgerId] = useState<string>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Currency State
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesLastUpdated, setRatesLastUpdated] = useState<number>(0);
  
  // UI Preferences
  const [uiPrefs, setUiPrefs] = useState<UIPreferences>(DEFAULT_UI_PREFS);
  
  // Date State (Global Filter)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Initialization: Load from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      // 防止意外卡死：超过 8 秒强制 fallback
      const safetyTimer = setTimeout(() => {
        console.warn("Load timeout fallback triggered");
        // 不注入示例数据，只结束 loading，允许用户手动刷新或继续
        setIsLoading(false);
      }, 6000);
      try {
        await db.initDB();
        
        // Init Currency Rates
        try {
          const ratesData = await fetchExchangeRates();
          setExchangeRates(ratesData.rates);
          setRatesLastUpdated(ratesData.lastUpdated);
        } catch (err) {
          console.warn("Fetch rates failed", err);
        }
        
        // Check if this is the very first run on this device
        const hasSeeded = localStorage.getItem('zenledger_has_seeded');

        if (!hasSeeded) {
            // First run: Seed DB with sample data
            console.log("First run detected. Seeding sample data...");
            await Promise.all([
                db.saveList(db.STORES.CATEGORIES, INITIAL_CATEGORIES),
                db.saveList(db.STORES.ACCOUNTS, INITIAL_ACCOUNTS),
                db.saveList(db.STORES.LEDGERS, INITIAL_LEDGERS),
                db.saveValue(db.STORES.USER, 'profile', INITIAL_USER),
                db.saveValue(db.STORES.SETTINGS, 'uiPreferences', DEFAULT_UI_PREFS)
            ]);
            
            // Set state to initial
            setTransactions([]);
            setCategories(INITIAL_CATEGORIES);
            setAccounts(INITIAL_ACCOUNTS);
            setLedgers(INITIAL_LEDGERS);
            setUser(INITIAL_USER);
            setUiPrefs(DEFAULT_UI_PREFS);
            if (INITIAL_LEDGERS.length > 0) setCurrentLedgerId(INITIAL_LEDGERS[0].id);
            
            // Mark as seeded so we don't do it again after a reset
            localStorage.setItem('zenledger_has_seeded', 'true');
        } else {
            // Subsequent runs: Load whatever is in DB
            const [loadedTxs, loadedCats, loadedAccs, loadedLedgers, loadedUser, loadedUiPrefs] = await Promise.all([
              db.getAll<Transaction>(db.STORES.TRANSACTIONS),
              db.getAll<Category>(db.STORES.CATEGORIES),
              db.getAll<Account>(db.STORES.ACCOUNTS),
              db.getAll<Ledger>(db.STORES.LEDGERS),
              db.getValue<UserProfile>(db.STORES.USER, 'profile'),
              db.getValue<UIPreferences>(db.STORES.SETTINGS, 'uiPreferences')
            ]);

            setTransactions(loadedTxs || []);
            setCategories((loadedCats && loadedCats.length) ? loadedCats : INITIAL_CATEGORIES);
            setAccounts(loadedAccs || []);
            setLedgers((loadedLedgers && loadedLedgers.length) ? loadedLedgers : INITIAL_LEDGERS);
            if (loadedUiPrefs) setUiPrefs(loadedUiPrefs);
            
            // Always ensure a user exists, even if DB was cleared
            if (loadedUser) {
                setUser(loadedUser);
            } else {
                setUser(INITIAL_USER);
                db.saveValue(db.STORES.USER, 'profile', INITIAL_USER);
            }
            
            // Set current ledger
            const leds = (loadedLedgers && loadedLedgers.length) ? loadedLedgers : INITIAL_LEDGERS;
            if (leds.length > 0) setCurrentLedgerId(leds[0].id);
        }

      } catch (e) {
        console.error("Failed to load data from IndexedDB", e);
        // 不写入任何示例数据，保持空，用户可重试
        setLedgers([]);
        setAccounts([]);
        setTransactions([]);
        setCategories([]);
      } finally {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper to save to DB asynchronously
  const persistData = async (store: string, data: any) => {
     try {
         if (store === db.STORES.USER) {
             await db.saveValue(store, 'profile', data);
         } else if (store === db.STORES.SETTINGS && data.showReports !== undefined) {
             await db.saveValue(store, 'uiPreferences', data);
         } else {
             await db.saveList(store, data);
         }
     } catch(e) {
         console.error(`Failed to persist ${store}`, e);
     }
  };

  // --- Reset Application Handler ---
  const handleAppReset = async () => {
    // 1. Enter Loading State immediately to protect UI from rendering empty/null data
    setIsLoading(true);
    const resetGuard = setTimeout(() => {
      console.warn("Reset guard timeout, forcing UI unlock");
      setIsLoading(false);
    }, 8000);
    
    try {
        console.log("Starting App Reset...");
        
        // 2. 强制重建空库并清空所有表（即使删除被阻塞也会清空）
        await db.rebuildEmptyDatabase();
        // 3. 保持“已初始化”标记，避免下次启动再塞示例数据
        localStorage.setItem('zenledger_has_seeded', 'true');
        
        // Manual Memory State Reset (Safe Fallback)
        setTransactions([]);
        setAccounts([]);
        
        // Reset to Factory Defaults for structure (Ledgers/Categories)
        setLedgers(INITIAL_LEDGERS);
        setCurrentLedgerId(INITIAL_LEDGERS[0].id);
        setCategories(INITIAL_CATEGORIES);
        setUser(INITIAL_USER);
        setUiPrefs(DEFAULT_UI_PREFS);

        // Persist the factory defaults to the new (empty) DB
        await Promise.all([
             db.saveList(db.STORES.LEDGERS, INITIAL_LEDGERS),
             db.saveList(db.STORES.CATEGORIES, INITIAL_CATEGORIES),
             db.saveValue(db.STORES.USER, 'profile', INITIAL_USER),
             db.saveValue(db.STORES.SETTINGS, 'uiPreferences', DEFAULT_UI_PREFS),
             db.saveList(db.STORES.ACCOUNTS, []), // Empty
             db.saveList(db.STORES.TRANSACTIONS, []) // Empty
        ]);

        // 核验清空结果，必要时再清一次
        const [chkTx, chkAcc] = await Promise.all([
          db.getAll(db.STORES.TRANSACTIONS),
          db.getAll(db.STORES.ACCOUNTS)
        ]);
        if ((chkTx && chkTx.length) || (chkAcc && chkAcc.length)) {
          console.warn('Verification found residual data, clearing stores again');
          await db.clearAllStores();
          await Promise.all([
            db.saveList(db.STORES.LEDGERS, INITIAL_LEDGERS),
            db.saveList(db.STORES.CATEGORIES, INITIAL_CATEGORIES),
            db.saveValue(db.STORES.USER, 'profile', INITIAL_USER),
            db.saveValue(db.STORES.SETTINGS, 'uiPreferences', DEFAULT_UI_PREFS)
          ]);
        }
        
    } catch (error) {
        console.error("Critical Error during App Reset:", error);
    } finally {
        clearTimeout(resetGuard);
        setIsLoading(false); 
    }
  };

  const handleUpdateCategories = (newCats: Category[]) => {
    setCategories(newCats);
    persistData(db.STORES.CATEGORIES, newCats);
  };
  
  const handleUpdateUser = (newUser: UserProfile) => {
    setUser(newUser);
    persistData(db.STORES.USER, newUser);
  }

  const handleUpdateUiPrefs = (newPrefs: UIPreferences) => {
      setUiPrefs(newPrefs);
      persistData(db.STORES.SETTINGS, newPrefs);
  };

  // --- Normalize imported backup for backward compatibility ---
  const normalizeBackup = (data: any) => {
      const ledgers = (Array.isArray(data?.ledgers) && data.ledgers.length) ? data.ledgers : INITIAL_LEDGERS;
      const primaryLedgerId = ledgers[0]?.id || INITIAL_LEDGERS[0].id;

      let accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      if (!accounts.length) {
          accounts = [{
              id: 'acc-default',
              ledgerId: primaryLedgerId,
              name: '默认账户',
              type: 'CHECKING' as AccountType,
              balance: 0,
              currency: 'CNY'
          }];
      } else {
          accounts = accounts.map(acc => ({
              ...acc,
              ledgerId: acc.ledgerId || primaryLedgerId,
              currency: acc.currency || 'CNY'
          }));
      }

      const categories = (Array.isArray(data?.categories) && data.categories.length) ? data.categories : INITIAL_CATEGORIES;
      const primaryCategoryId = categories[0]?.id || INITIAL_CATEGORIES[0].id;

      let transactions = Array.isArray(data?.transactions) ? data.transactions : [];
      transactions = transactions.map((tx, idx) => ({
          ...tx,
          id: tx.id || `imp-${Date.now()}-${idx}`,
          ledgerId: tx.ledgerId || primaryLedgerId,
          accountId: tx.accountId || accounts[0].id,
          categoryId: tx.categoryId || primaryCategoryId,
          currency: tx.currency || 'CNY',
          original_currency: tx.original_currency || 'CNY',
          original_amount: tx.original_amount !== undefined ? tx.original_amount : tx.amount,
          exchange_rate: tx.exchange_rate || 1,
          mood: tx.mood || 'neutral',
      }));

      const userProfile = data?.user || INITIAL_USER;
      const storageConfig = data?.settings || null;
      const uiPreferences = data?.uiPreferences || DEFAULT_UI_PREFS;

      return { ledgers, accounts, categories, transactions, userProfile, storageConfig, uiPreferences, primaryLedgerId };
  };
  
  // Import Start
  const handleImportDataRequest = (data: any) => {
      setPendingImportData(data);
      setIsImportConfirmOpen(true);
  };

  // Import Execution
  const executeImport = async (shouldOverwrite: boolean) => {
     setIsImportConfirmOpen(false);
     const data = pendingImportData;
     if (!data) return;

     setIsLoading(true);
     const importTimer = setTimeout(() => {
        console.warn("Import timeout fallback triggered");
        setIsLoading(false);
     }, 8000);
     try {
         await db.initDB();

         if (shouldOverwrite) {
             const normalized = normalizeBackup(data);
             await db.clearAllStores();
             await db.saveList(db.STORES.LEDGERS, normalized.ledgers);
             await db.saveList(db.STORES.ACCOUNTS, normalized.accounts);
             await db.saveList(db.STORES.TRANSACTIONS, normalized.transactions);
             await db.saveList(db.STORES.CATEGORIES, normalized.categories);
             await db.saveValue(db.STORES.USER, 'profile', normalized.userProfile);
             if (normalized.storageConfig) await db.saveValue(db.STORES.SETTINGS, 'storageConfig', normalized.storageConfig);
             await db.saveValue(db.STORES.SETTINGS, 'uiPreferences', normalized.uiPreferences);
             localStorage.setItem('zenledger_has_seeded', 'true');

             setLedgers(normalized.ledgers);
             setAccounts(normalized.accounts);
             setTransactions(normalized.transactions);
             setCategories(normalized.categories);
             setUser(normalized.userProfile);
             setUiPrefs(normalized.uiPreferences);
             setCurrentLedgerId(normalized.primaryLedgerId);

         } else {
             const normalized = normalizeBackup(data);
             await db.mergeList(db.STORES.LEDGERS, normalized.ledgers);
             await db.mergeList(db.STORES.ACCOUNTS, normalized.accounts);
             await db.mergeList(db.STORES.TRANSACTIONS, normalized.transactions);
             await db.mergeList(db.STORES.CATEGORIES, normalized.categories);
             await db.saveValue(db.STORES.USER, 'profile', normalized.userProfile);
             if (normalized.storageConfig) await db.saveValue(db.STORES.SETTINGS, 'storageConfig', normalized.storageConfig);
             await db.saveValue(db.STORES.SETTINGS, 'uiPreferences', normalized.uiPreferences);

             const [loadedTxs, loadedCats, loadedAccs, loadedLedgers, loadedUser] = await Promise.all([
                db.getAll<Transaction>(db.STORES.TRANSACTIONS),
                db.getAll<Category>(db.STORES.CATEGORIES),
                db.getAll<Account>(db.STORES.ACCOUNTS),
                db.getAll<Ledger>(db.STORES.LEDGERS),
                db.getValue<UserProfile>(db.STORES.USER, 'profile')
             ]);
             setTransactions(loadedTxs || []);
             setCategories((loadedCats && loadedCats.length) ? loadedCats : INITIAL_CATEGORIES);
             setAccounts(loadedAccs || []);
             setLedgers((loadedLedgers && loadedLedgers.length) ? loadedLedgers : INITIAL_LEDGERS);
             if (loadedUser) setUser(loadedUser);
             setCurrentLedgerId((loadedLedgers && loadedLedgers.length ? loadedLedgers[0].id : normalized.primaryLedgerId));
         }
     } catch (e) {
         console.error("Import failed", e);
     } finally {
         clearTimeout(importTimer);
         setIsLoading(false);
         setPendingImportData(null);
     }
  };

  const currentLedger = ledgers.find(l => l.id === currentLedgerId) || ledgers[0] || INITIAL_LEDGERS[0];
  const currentAccounts = accounts.filter(a => a.ledgerId === currentLedgerId);
  const currentTransactions = transactions.filter(t => t.ledgerId === currentLedgerId);
  
  const t = I18N[user.language];

  // Navigation Helpers
  const navigateTo = (view: string) => setViewStack(prev => [...prev, view]);
  const goBack = () => setViewStack(prev => prev.slice(0, -1));

  // Expose back handler to Android WebView so native back knows当前前端状态
  useEffect(() => {
    (window as any).__ANDROID_BACK__ = () => {
      if (isTxModalOpen) {
        setIsTxModalOpen(false);
        setEditingTransaction(null);
        return "handled";
      }
      if (isAccountModalOpen) {
        setIsAccountModalOpen(false);
        setEditingAccount(null);
        return "handled";
      }
      if (isLedgerListOpen) {
        setIsLedgerListOpen(false);
        return "handled";
      }
      if (isImportConfirmOpen) {
        setIsImportConfirmOpen(false);
        setPendingImportData(null);
        return "handled";
      }

      if (viewStack.length > 0) {
        const top = viewStack[viewStack.length - 1];

        // If we're inside Settings, let Settings handle its own inner views first
        if (top === 'SETTINGS') {
          const settingsBack = (window as any).__SETTINGS_BACK__;
          if (typeof settingsBack === 'function') {
            const res = settingsBack();
            if (res === "handled") return "handled";
          }
        }

        setViewStack(prev => prev.slice(0, -1));
        if (top === 'ACCOUNT_DETAIL') setViewingAccount(null);
        return "handled";
      }

      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return "handled";
      }

      return "exit";
    };

    return () => {
      delete (window as any).__ANDROID_BACK__;
    };
  }, [isTxModalOpen, isAccountModalOpen, isLedgerListOpen, isImportConfirmOpen, viewStack, activeTab]);

  // --- Account Handlers ---
  const handleSaveAccount = (data: Partial<Account>) => {
      let updatedAccounts = [...accounts];
      
      if (data.id) {
          updatedAccounts = updatedAccounts.map(a => a.id === data.id ? { ...a, ...data } : a);
          if (viewingAccount?.id === data.id) {
             setViewingAccount(updatedAccounts.find(a => a.id === data.id) || null);
          }
      } else {
          const newAccount: Account = {
              id: `a${Date.now()}`,
              ledgerId: currentLedgerId,
              name: data.name || 'New Account',
              type: data.type || 'CHECKING',
              currency: data.currency || 'CNY',
              balance: data.balance || 0,
              icon: 'credit-card',
              isExcluded: data.isExcluded,
              creditLimit: data.creditLimit,
              statementDay: data.statementDay,
              paymentDueDay: data.paymentDueDay,
              interestRate: data.interestRate,
              dueDate: data.dueDate
          };
          updatedAccounts.push(newAccount);
      }
      setAccounts(updatedAccounts);
      persistData(db.STORES.ACCOUNTS, updatedAccounts);
  };

  const handleDeleteAccount = (id: string) => {
      const updated = accounts.filter(a => a.id !== id);
      setAccounts(updated);
      persistData(db.STORES.ACCOUNTS, updated);
      if (viewingAccount?.id === id) {
          setViewingAccount(null);
          setViewStack(prev => prev.filter(v => v !== 'ACCOUNT_DETAIL'));
      }
  };

  const handleViewAccount = (account: Account) => {
      setViewingAccount(account);
      navigateTo('ACCOUNT_DETAIL');
  };

  // --- Transaction Handlers ---
  const handleSaveTransaction = (data: AIParseResult & { 
        installmentCurrent?: number, 
        installmentTotal?: number, 
        installmentFee?: number,
        mood?: string,
        original_amount?: number,
        original_currency?: string,
        exchange_rate?: number
    }, targetAccountId: string) => {
    let catId = data.category;
    
    // Resolve Category Name to ID if it's not already an ID
    const exists = categories.some(c => c.id === catId || c.subCategories?.some(s => s.id === catId));
    if (!exists) {
       const found = categories.find(c => c.name.toLowerCase() === catId.toLowerCase());
       if (found) catId = found.id;
       else catId = categories[0].id; 
    }

    if (editingTransaction) {
        // --- UPDATE EXISTING ---
        const oldAccount = accounts.find(a => a.id === editingTransaction.accountId);
        let tempAccounts = [...accounts];
        
        if (oldAccount) {
            const revertAmount = editingTransaction.type === TransactionType.INCOME ? -editingTransaction.amount : editingTransaction.amount;
            tempAccounts = tempAccounts.map(a => a.id === oldAccount.id ? { ...a, balance: a.balance + revertAmount } : a);
        }

        const targetIndex = tempAccounts.findIndex(a => a.id === targetAccountId);
        if (targetIndex !== -1) {
             const applyAmount = data.type === TransactionType.INCOME ? data.amount : -data.amount;
             const updatedAccount = { ...tempAccounts[targetIndex], balance: tempAccounts[targetIndex].balance + applyAmount };
             tempAccounts[targetIndex] = updatedAccount;
        }

        setAccounts(tempAccounts);
        persistData(db.STORES.ACCOUNTS, tempAccounts);

        const updatedTxList = transactions.map(t => {
            if (t.id === editingTransaction.id) {
                return {
                    ...t,
                    amount: data.amount,
                    currency: data.currency,
                    categoryId: catId,
                    accountId: targetAccountId,
                    date: data.date,
                    description: data.description,
                    merchant: data.merchant,
                    type: data.type,
                    installmentCurrent: data.installmentCurrent,
                    installmentTotal: data.installmentTotal,
                    installmentFee: data.installmentFee,
                    mood: data.mood,
                    original_amount: data.original_amount,
                    original_currency: data.original_currency,
                    exchange_rate: data.exchange_rate,
                };
            }
            return t;
        });
        setTransactions(updatedTxList);
        persistData(db.STORES.TRANSACTIONS, updatedTxList);
        
    } else {
        // --- CREATE NEW ---
        const newTx: Transaction = {
          id: Date.now().toString(),
          ledgerId: currentLedgerId,
          accountId: targetAccountId,
          amount: data.amount,
          currency: data.currency || currentLedger.currency,
          categoryId: catId,
          date: data.date,
          description: data.description,
          merchant: data.merchant,
          type: data.type,
          installmentCurrent: data.installmentCurrent,
          installmentTotal: data.installmentTotal,
          installmentFee: data.installmentFee,
          installmentStatus: (data.installmentTotal && data.installmentTotal > 1) ? 'ACTIVE' : undefined,
          mood: data.mood,
          original_amount: data.original_amount,
          original_currency: data.original_currency,
          exchange_rate: data.exchange_rate,
        };

        const updatedTx = [newTx, ...transactions];
        setTransactions(updatedTx);
        persistData(db.STORES.TRANSACTIONS, updatedTx);

        // Update Balance
        const updatedAccounts = accounts.map(acc => {
          if (acc.id === targetAccountId) {
              const change = data.type === TransactionType.INCOME ? data.amount : -data.amount;
              return { ...acc, balance: acc.balance + change };
          }
          return acc;
        });
        setAccounts(updatedAccounts);
        persistData(db.STORES.ACCOUNTS, updatedAccounts);
    }
    setEditingTransaction(null);
  };

  const handleBatchDelete = async (ids: string[]) => {
      // 1. Revert Balances
      let tempAccounts = [...accounts];
      
      const txsToDelete = transactions.filter(t => ids.includes(t.id));
      
      txsToDelete.forEach(tx => {
          const accIndex = tempAccounts.findIndex(a => a.id === tx.accountId);
          if (accIndex !== -1) {
              const revertAmount = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
              tempAccounts[accIndex] = { 
                  ...tempAccounts[accIndex], 
                  balance: tempAccounts[accIndex].balance + revertAmount 
              };
          }
      });
      setAccounts(tempAccounts);
      persistData(db.STORES.ACCOUNTS, tempAccounts);

      // 2. Remove Txs
      const remaining = transactions.filter(t => !ids.includes(t.id));
      setTransactions(remaining);
      
      // 3. DB Delete
      await db.deleteItems(db.STORES.TRANSACTIONS, ids);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTxModalOpen(true);
  };
  
  const handleDeleteTransaction = async (id: string) => {
      await handleBatchDelete([id]);
  };

  const handleEarlyRepayment = (txId: string) => {
      const updated = transactions.map(t => t.id === txId ? { ...t, installmentStatus: 'EARLY_REPAID' as const } : t);
      setTransactions(updated);
      persistData(db.STORES.TRANSACTIONS, updated);
      alert(t.planRepaid);
  };

  // --- Render ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-blue-600 animate-spin" />
          <p className="text-gray-400 font-bold animate-pulse">{t.loading}</p>
        </div>
      </div>
    );
  }

  // --- View Routing ---
  if (viewStack.length > 0) {
      const currentView = viewStack[viewStack.length - 1];

      if (currentView === 'SETTINGS') {
          return (
             <SettingsPage 
                onBack={goBack}
                user={user}
                onUpdateUser={handleUpdateUser}
                onImportData={handleImportDataRequest}
                onBatchAddTransactions={(txs) => {
                    const defaultAcc = accounts[0];
                    if (!defaultAcc) {
                        alert(t.noAccountsFound);
                        return;
                    }
                    
                    const newTxs = txs.map((t, i) => {
                         // Resolve Category Name to ID
                         let catId = '';
                         const foundCat = categories.find(c => c.name === t.category);
                         if (foundCat) {
                             catId = foundCat.id;
                         } else {
                             const otherCat = categories.find(c => c.name === '其他' || c.name.includes('Other'));
                             if (otherCat) {
                                 catId = otherCat.id;
                             } else {
                                 const typeCat = categories.find(c => c.type === t.type);
                                 catId = typeCat ? typeCat.id : (categories[0]?.id || 'unknown');
                             }
                         }

                         // Resolve Account ID based on accountName
                         let targetAccountId = defaultAcc.id;
                         if (t.accountName) {
                             const foundAcc = accounts.find(a => 
                                 (t.accountName === '支付宝' && (a.type === 'ALIPAY' || a.name.includes('支付宝') || a.name.toLowerCase().includes('alipay'))) ||
                                 (t.accountName === '微信' && (a.type === 'WECHAT' || a.name.includes('微信') || a.name.toLowerCase().includes('wechat'))) ||
                                 a.name.includes(t.accountName)
                             );
                             if (foundAcc) targetAccountId = foundAcc.id;
                         }

                         return {
                             id: `imp-${Date.now()}-${i}`,
                             ledgerId: currentLedgerId,
                             accountId: targetAccountId,
                             amount: t.amount,
                             currency: t.currency || 'CNY',
                             categoryId: catId, 
                             date: t.date,
                             description: t.description,
                             merchant: t.merchant,
                             type: t.type,
                             mood: t.mood || 'neutral',
                             original_amount: t.original_amount !== undefined ? t.original_amount : t.amount,
                             original_currency: t.original_currency || 'CNY',
                             exchange_rate: t.exchange_rate || 1
                         };
                    });
                    
                    const merged = [...newTxs, ...transactions];
                    setTransactions(merged as Transaction[]); 
                    persistData(db.STORES.TRANSACTIONS, merged); 
                    
                    // Update Balances per Account
                    const balanceChanges: Record<string, number> = {};
                    newTxs.forEach(t => {
                        const val = t.type === 'INCOME' ? t.amount : -t.amount;
                        balanceChanges[t.accountId] = (balanceChanges[t.accountId] || 0) + val;
                    });

                    const updatedAccs = accounts.map(a => {
                        if (balanceChanges[a.id]) {
                            return { ...a, balance: a.balance + balanceChanges[a.id] };
                        }
                        return a;
                    });
                    
                    setAccounts(updatedAccs);
                    persistData(db.STORES.ACCOUNTS, updatedAccs);
                    
                    goBack(); 
                }}
                fullData={{ transactions, accounts, ledgers, categories, user }}
                onAppReset={handleAppReset}
                uiPrefs={uiPrefs}
                onUpdateUiPrefs={handleUpdateUiPrefs}
             />
          );
      }
      
      if (currentView === 'ACCOUNTS_PAGE') {
          return (
              <div className="flex h-screen bg-[#F2F2F7]">
                 <Sidebar 
                    activeTab={activeTab} setActiveTab={setActiveTab} 
                    ledgers={ledgers} currentLedgerId={currentLedgerId} setCurrentLedgerId={setCurrentLedgerId}
                    user={user} onOpenSettings={() => navigateTo('SETTINGS')}
                    onCreateLedger={() => setIsLedgerListOpen(true)}
                    uiPrefs={uiPrefs}
                 />
                 <div className="flex-1 flex flex-col min-h-0 md:pl-72">
                    <div className="p-4 overflow-y-auto h-full">
                       <div className="flex items-center gap-4 mb-4 md:hidden">
                           <button onClick={goBack}><ArrowLeft/></button>
                           <h1 className="text-xl font-bold">{t.accounts}</h1>
                       </div>
                       <AccountsPage 
                           accounts={currentAccounts}
                           user={user}
                           currentLedger={currentLedger}
                           onAddAccount={() => { setIsAccountModalOpen(true); setEditingAccount(null); }}
                           onViewAccount={handleViewAccount}
                           transactions={currentTransactions}
                           exchangeRates={exchangeRates}
                       />
                    </div>
                 </div>
              </div>
          );
      }
      
      if (currentView === 'ACCOUNT_DETAIL' && viewingAccount) {
           return (
             <>
               <AccountDetail 
                   account={viewingAccount}
                   transactions={transactions.filter(t => t.accountId === viewingAccount.id)}
                   user={user}
                   categories={categories}
                   onBack={goBack}
                   onEdit={(acc) => { setEditingAccount(acc); setIsAccountModalOpen(true); }}
                   onEarlyRepayment={handleEarlyRepayment}
               />

               {isAccountModalOpen && (
                  <AccountFormModal 
                      isOpen={isAccountModalOpen}
                      onClose={() => setIsAccountModalOpen(false)}
                      onSave={handleSaveAccount}
                      onDelete={handleDeleteAccount}
                      initialData={editingAccount}
                      user={user}
                      exchangeRates={exchangeRates}
                  />
               )}
             </>
           );
      }
  }

  // --- Main Layout ---
  return (
    <div className="bg-[#F2F2F7] min-h-screen flex flex-col md:flex-row text-gray-900 font-sans">
      <Sidebar 
         activeTab={activeTab} 
         setActiveTab={setActiveTab} 
         ledgers={ledgers} 
         currentLedgerId={currentLedgerId} 
         setCurrentLedgerId={setCurrentLedgerId}
         user={user}
         onOpenSettings={() => navigateTo('SETTINGS')}
         onCreateLedger={() => setIsLedgerListOpen(true)}
         uiPrefs={uiPrefs}
      />

      <div className="flex-1 flex flex-col min-h-0 md:pl-72 relative transition-all duration-300">
        
        {/* Only show MobileHeader if NOT on Dashboard, because Dashboard now has unified header */}
        {activeTab !== 'dashboard' && (
            <MobileHeader 
               currentLedger={currentLedger} 
               user={user} 
               onOpenSettings={() => navigateTo('SETTINGS')}
               onOpenLedgerList={() => setIsLedgerListOpen(true)} 
               activeTab={activeTab}
            />
        )}
        
        {/* Remove top padding if on Dashboard, otherwise keep space for MobileHeader */}
        <div className={`flex-1 overflow-y-auto no-scrollbar ${activeTab === 'dashboard' ? 'pt-0' : 'pt-[60px] md:pt-0'}`}>
           {activeTab === 'dashboard' && (
              <Dashboard 
                 accounts={currentAccounts}
                 transactions={currentTransactions}
                 onAddClick={() => { setEditingTransaction(null); setIsTxModalOpen(true); }}
                 user={user}
                 currentLedger={currentLedger}
                 categories={categories}
                 onViewHistory={() => {}}
                 currentDate={currentDate}
                 onDateChange={setCurrentDate}
                 onEditTransaction={handleEditTransaction}
                 onBatchDelete={handleBatchDelete}
                 onOpenSettings={() => navigateTo('SETTINGS')}
                 onOpenLedgerList={() => setIsLedgerListOpen(true)} 
              />
           )}
           {activeTab === 'reports' && (
              <div className="p-4 md:p-8">
                 <Reports 
                    transactions={currentTransactions} 
                    user={user} 
                    categories={categories}
                    currentDate={currentDate}
                    accounts={currentAccounts}
                    currentLedger={currentLedger}
                    exchangeRates={exchangeRates}
                 />
              </div>
           )}
           {activeTab === 'accounts' && (
              <div className="p-4 md:p-8">
                  <AccountsPage 
                      accounts={currentAccounts}
                      user={user}
                      currentLedger={currentLedger}
                      onAddAccount={() => { setIsAccountModalOpen(true); setEditingAccount(null); }}
                      onViewAccount={handleViewAccount}
                      transactions={currentTransactions}
                      exchangeRates={exchangeRates}
                  />
              </div>
           )}
        </div>

        <MobileNavbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} uiPrefs={uiPrefs} />
      </div>

      {/* MODALS */}
      <TransactionModal 
        isOpen={isTxModalOpen} 
        onClose={() => { setIsTxModalOpen(false); setEditingTransaction(null); }}
        onSave={handleSaveTransaction}
        onDelete={editingTransaction ? () => handleDeleteTransaction(editingTransaction.id) : undefined}
        user={user}
        accounts={currentAccounts}
        categories={categories}
        onUpdateCategories={handleUpdateCategories}
        initialData={editingTransaction}
        ledgerCurrency={currentLedger.currency}
        exchangeRates={exchangeRates}
        lastUpdated={ratesLastUpdated}
      />
      
      {isAccountModalOpen && (
          <AccountFormModal 
              isOpen={isAccountModalOpen}
              onClose={() => setIsAccountModalOpen(false)}
              onSave={handleSaveAccount}
              onDelete={handleDeleteAccount}
              initialData={editingAccount}
              user={user}
              exchangeRates={exchangeRates}
          />
      )}
      
      {/* LedgerList */}
      {isLedgerListOpen && (
        <LedgerList 
           onBack={() => setIsLedgerListOpen(false)}
           ledgers={ledgers} 
           currentLedgerId={currentLedgerId} 
           onSelectLedger={(id) => { setCurrentLedgerId(id); setIsLedgerListOpen(false); }}
           onCreateLedger={(n, c) => {
               const newLedger: Ledger = { id: `l${Date.now()}`, name: n, currency: c, color: 'bg-blue-500', icon: '📒' };
               const updated = [...ledgers, newLedger];
               setLedgers(updated);
               persistData(db.STORES.LEDGERS, updated);
               setCurrentLedgerId(newLedger.id);
               setIsLedgerListOpen(false);
           }}
           onUpdateLedger={(id, n, c) => {
               const updated = ledgers.map(l => l.id === id ? { ...l, name: n, currency: c } : l);
               setLedgers(updated);
               persistData(db.STORES.LEDGERS, updated);
           }}
           user={user}
        />
      )}
      
      {/* Import Confirmation Modal */}
      {isImportConfirmOpen && pendingImportData && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 animate-fade-in-up">
                  <h3 className="text-xl font-bold mb-2">{t.importBackup}</h3>
                  <p className="text-gray-500 mb-6">{t.importPrompt}</p>
                  <div className="space-y-3">
                      <button onClick={() => executeImport(true)} className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100">
                          {t.overwrite}
                      </button>
                      <button onClick={() => executeImport(false)} className="w-full py-4 bg-blue-50 text-blue-600 font-bold rounded-xl border border-blue-100">
                          {t.merge}
                      </button>
                      <button onClick={() => setIsImportConfirmOpen(false)} className="w-full py-4 bg-gray-100 text-gray-900 font-bold rounded-xl">
                          {t.cancel}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
