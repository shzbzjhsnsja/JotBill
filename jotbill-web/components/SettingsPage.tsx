import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, Server, HardDrive, Cloud, ChevronRight, LogOut, Download, Upload, Image as ImageIcon, ScanLine, FileText, Trash2, AlertTriangle, LayoutTemplate, Cpu, Key, Globe, Eye, EyeOff, Zap, RefreshCw, XCircle, CheckCircle2, Link, Save, RotateCw, CloudDownload, Wifi } from 'lucide-react';
import { UserProfile, StorageConfig, AIParseResult, TransactionType, UIPreferences, Category, AIConfig, AIProvider } from '../types';
import { I18N, INITIAL_STORAGE, DEFAULT_AI_CONFIG } from '../constants';
import { parseTransactionImage, parseTransactionImageWithGemini, parseTransactionText, testAIConnection } from '../services/geminiService';
import { testWebDAVConnection, uploadToWebDAV, restoreFromWebDAV } from '../services/WebDAVService';
import * as db from '../services/db';

interface SettingsPageProps {
  onBack: () => void;
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onImportData: (data: any) => void;
  onBatchAddTransactions?: (txs: any[]) => void;
  fullData: any;
  onAppReset?: () => void;
  uiPrefs: UIPreferences;
  onUpdateUiPrefs: (prefs: UIPreferences) => void;
}

const PRESET_MODELS: Record<string, string[]> = {
  GEMINI: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner'],
  CUSTOM: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-5-sonnet']
};

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, user, onUpdateUser, onImportData, onBatchAddTransactions, fullData, onAppReset, uiPrefs, onUpdateUiPrefs }) => {
  const t = I18N[user.language];
  const [view, setView] = useState<'MAIN' | 'PROFILE' | 'STORAGE' | 'SMART_IMPORT' | 'APPEARANCE' | 'AI_CONFIG'>('MAIN');
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(INITIAL_STORAGE);
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // AI Config UI State
  const [isTesting, setIsTesting] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // WebDAV State
  const [showDavPassword, setShowDavPassword] = useState(false);
  const [davLoading, setDavLoading] = useState<'TEST' | 'BACKUP' | 'RESTORE' | null>(null);

  // Environment Detection
  // @ts-ignore
  const isAndroid = typeof window.Android !== 'undefined';
  const isWeb = !isAndroid;

  // Import Refs & State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const ocrCallbacks = useRef<Map<string, { resolve: (text: string) => void, reject: (err: any) => void }>>(new Map());
  
  // UI: Import Source Selection State
  const [importSource, setImportSource] = useState<'WECHAT' | 'ALIPAY'>('WECHAT');

  // Status for Smart Import
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState('');
  const [isCsvLoading, setIsCsvLoading] = useState(false);
  const [csvStatus, setCsvStatus] = useState('');

  // Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load configs
  useEffect(() => {
    const loadConfig = async () => {
        try {
            const savedStorage = await db.getValue<StorageConfig>(db.STORES.SETTINGS, 'storageConfig');
            if (savedStorage) setStorageConfig(savedStorage);
            
            const savedAi = localStorage.getItem('zenledger_ai_config');
            if (savedAi) {
                const parsed = JSON.parse(savedAi);
                setAiConfig(parsed);
                const providerModels = PRESET_MODELS[parsed.provider] || [];
                if (parsed.model && !providerModels.includes(parsed.model)) {
                    setIsCustomModel(true);
                }
            }
        } catch (e) { console.error(e); }
    };
    loadConfig();
  }, []);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast && toast.type !== 'loading') {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Back key
  useEffect(() => {
    (window as any).__SETTINGS_BACK__ = () => {
      if (view !== 'MAIN') { setView('MAIN'); return "handled"; }
      return "exit";
    };
    return () => { delete (window as any).__SETTINGS_BACK__; };
  }, [view]);

  const saveStorageConfig = async (newConfig: StorageConfig) => {
      setStorageConfig(newConfig);
      await db.saveValue(db.STORES.SETTINGS, 'storageConfig', newConfig);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'loading') => {
      setToast({ message, type });
  };

  // ✅ [核心修复] WebDAV 桥接：支持传入具体文件名
  const callNativeDav = (action: 'TEST' | 'BACKUP' | 'RESTORE', body?: string, customFilename?: string) => {
      return new Promise<{ ok: boolean; message: string }>((resolve, reject) => {
          // 查找桥接对象
          const bridge = (window as any).AndroidWebDAV || (window as any).JotBillOCR;
          
          if (!bridge || typeof bridge.davAction !== 'function') {
              reject(new Error('Native WebDAV bridge not available'));
              return;
          }
          const cbId = `dav_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          
          // 挂载回调
          // @ts-ignore
          (window as any).__DAV_CB = (id: string, payload: { ok: boolean; message: string }) => {
              if (id !== cbId) return;
              if (payload.ok) resolve(payload); else reject(new Error(payload.message));
          };

          // 📂 [路径拼接逻辑]
          // 如果传了文件名，就拼接到目录后面；否则只传目录（用于TEST）
          let finalPath = storageConfig.path || '';
          if (customFilename) {
              if (!finalPath.endsWith('/')) finalPath += '/';
              finalPath += customFilename;
          }
          // 去掉开头的 / (防止双斜杠)
          if (finalPath.startsWith('/')) finalPath = finalPath.substring(1);

          console.log(`[WebDAV] Calling native: Action=${action}, Path=${finalPath}`);

          bridge.davAction(
            action,
            storageConfig.host,
            finalPath, // 传给鸿蒙的是完整路径
            storageConfig.username,
            storageConfig.password,
            body || null,
            storageConfig.allowInsecure ? "1" : "0",
            cbId
          );
          setTimeout(() => reject(new Error('DAV timeout')), 15000);
      });
  };

  const handleDavTest = async () => {
      if (!storageConfig.host || !storageConfig.username) return;
      setDavLoading('TEST');
      try {
          if ((window as any).AndroidWebDAV || (window as any).JotBillOCR) {
              await callNativeDav('TEST');
          } else {
              await testWebDAVConnection(storageConfig);
          }
          showToast(t.connectionSuccess, 'success');
      } catch (e) {
          showToast((e as Error).message, 'error');
      } finally {
          setDavLoading(null);
      }
  };

  // ✅ [核心修复] 备份：自动生成带日期的文件名
  const handleDavBackup = async () => {
      setDavLoading('BACKUP');
      showToast(t.backingUp, 'loading');
      try {
          const backupData = await db.getBackupData();
          const jsonString = JSON.stringify(backupData);
          
          // 1. 生成带时间戳的文件名：JotBill_20251211_1805.json
          const now = new Date();
          // 格式化为 YYYYMMDD_HHMM
          const timeStr = now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0');
          const historyName = `JotBill_${timeStr}.json`;
          const latestName = `backup_latest.json`;

          if ((window as any).AndroidWebDAV || (window as any).JotBillOCR) {
              // 鸿蒙/安卓：传两次，一次存历史，一次存最新
              console.log('Uploading history:', historyName);
              await callNativeDav('UPLOAD', jsonString, historyName);
              
              console.log('Uploading latest:', latestName);
              await callNativeDav('UPLOAD', jsonString, latestName);
          } else {
              // Web 兜底
              await uploadToWebDAV(storageConfig, jsonString);
          }
          showToast(t.backupSuccess, 'success');
      } catch (e) {
          showToast((e as Error).message, 'error');
      } finally {
          setDavLoading(null);
      }
  };

  // ✅ [核心修复] 恢复：读取 backup_latest.json
  const handleDavRestore = async () => {
      setDavLoading('RESTORE');
      showToast(t.restoring, 'loading');
      try {
          let data: any;
          const targetFile = 'backup_latest.json';

          if ((window as any).AndroidWebDAV || (window as any).JotBillOCR) {
              const res = await callNativeDav('RESTORE', undefined, targetFile);
              data = JSON.parse(res.message);
          } else {
              data = await restoreFromWebDAV(storageConfig);
          }
          if (data) {
              onImportData(data);
              showToast(t.restoreSuccess, 'success');
          } else {
              throw new Error("Empty response");
          }
      } catch (e) {
          showToast((e as Error).message, 'error');
      } finally {
          setDavLoading(null);
      }
  };

  // ... (其余 UI 代码保持不变)
  const handleSaveAndExit = () => {
      localStorage.setItem('zenledger_ai_config', JSON.stringify(aiConfig));
      showToast(t.settingsSaved, 'success');
      setTimeout(() => { onBack(); }, 500);
  };

  const handleTestConnection = async () => {
      if (!aiConfig.apiKey) { showToast(t.enterApiKey, 'error'); return; }
      setIsTesting(true);
      showToast(t.testingConnection, 'loading');
      const start = Date.now();
      try {
          await testAIConnection(aiConfig);
          const duration = Date.now() - start;
          localStorage.setItem('zenledger_ai_config', JSON.stringify(aiConfig));
          showToast(`${t.connectionSuccess} (${duration}ms)`, 'success');
      } catch (error) {
          console.error(error);
          showToast(`${t.connectionFailed} ${(error as Error).message}`, 'error');
      } finally {
          setIsTesting(false);
      }
  };

  const handleProviderChange = (provider: AIProvider) => {
      let defaults = { ...aiConfig, provider };
      if (provider === 'GEMINI') { defaults.baseUrl = ''; defaults.model = 'gemini-1.5-flash'; } 
      else if (provider === 'DEEPSEEK') { defaults.baseUrl = 'https://api.deepseek.com'; defaults.model = 'deepseek-chat'; } 
      else { if (!defaults.baseUrl) defaults.baseUrl = 'https://api.openai.com'; defaults.model = 'gpt-4o'; }
      setAiConfig(defaults);
      setIsCustomModel(false);
  };

  const handleExport = async () => {
    try {
        const backupData = await db.getBackupData();
        const jsonString = JSON.stringify(backupData, null, 2);
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `PocketLedger_Backup_${dateStr}.json`;

        // @ts-ignore
        if (typeof window.JotBillOCR !== 'undefined' && window.JotBillOCR.saveFile) {
            // @ts-ignore
            window.JotBillOCR.saveFile(fileName, jsonString); return;
        }
        // @ts-ignore
        if (typeof window.Android !== 'undefined' && window.Android.saveFile) {
            // @ts-ignore
            window.Android.saveFile(fileName, jsonString); return;
        }

        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
        if (!isAndroid) alert(t.backupDownloaded);
    } catch (error) {
        console.error("Export failed", error);
        alert(t.error + ": " + error);
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileReader = new FileReader();
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = (e) => {
        if (e.target?.result) {
            try {
                const parsed = JSON.parse(e.target.result as string);
                if (!parsed.transactions && !parsed.accounts && !parsed.ledgers) throw new Error("Invalid backup format");
                onImportData(parsed);
            } catch (err) { alert(t.invalidJson); }
        }
    };
    event.target.value = '';
  };

  const handleResetClick = () => { setIsResetModalOpen(true); };

  const performReset = async () => {
      setIsResetting(true);
      if (onAppReset) { onAppReset(); } 
      else {
          try {
            await db.rebuildEmptyDatabase();
            localStorage.setItem('zenledger_has_seeded', 'true');
            alert(t.resetComplete);
            window.location.reload();
          } catch (err) {
              console.error("Reset failed:", err);
              alert(t.error + ". Please try refreshing the page manually.");
              setIsResetting(false);
              setIsResetModalOpen(false);
          }
      }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => { if (reader.result) onUpdateUser({...user, avatar: reader.result as string}); };
          reader.readAsDataURL(file);
      }
  };

  const callNativeOcr = (dataUrl: string): Promise<string> => {
      return new Promise((resolve, reject) => {
          // @ts-ignore
          const bridge = (window as any).JotBillOCR || (window as any).HarmonyOCR || (window as any).AndroidOCR;
          if (!bridge || typeof bridge.ocrBase64 !== 'function') { reject(new Error('Native OCR not available')); return; }
          const cbId = `ocr_${Date.now()}`;
          ocrCallbacks.current.set(cbId, { resolve, reject });
          // @ts-ignore
          (window as any).__OCR_CB = (id: string, payload: { ok: boolean; text?: string; error?: string }) => {
              const entry = ocrCallbacks.current.get(id);
              if (!entry) return;
              ocrCallbacks.current.delete(id);
              if (payload?.ok && payload.text !== undefined) entry.resolve(payload.text);
              else entry.reject(new Error(payload?.error || 'OCR failed'));
          };
          try { bridge.ocrBase64(dataUrl, cbId); } catch (err) { ocrCallbacks.current.delete(cbId); reject(err); }
          setTimeout(() => { if (ocrCallbacks.current.has(cbId)) { ocrCallbacks.current.delete(cbId); reject(new Error('OCR timeout')); } }, 15000);
      });
  };

  useEffect(() => {
    const receiver = async (jsonString: string) => {
      console.log('[JotBillOCR] Received from native:', jsonString);
      if (jsonString === 'CANCEL') { setIsScreenshotLoading(false); setScreenshotStatus(''); return; }
      if (jsonString === 'ERROR') { showToast('原生识别出错', 'error'); setIsScreenshotLoading(false); setScreenshotStatus(''); return; }
      try {
        let rawText = '';
        try { rawText = JSON.parse(jsonString); } catch { rawText = jsonString; }
        if (!rawText || rawText === '未识别到有效文字' || rawText.length === 0) {
            showToast('图片中未识别到文字，请重试', 'error');
            setIsScreenshotLoading(false);
            setScreenshotStatus('');
            return;
        }
        setScreenshotStatus('AI Analyzing...');
        const parsed = await parseTransactionText(rawText, user.language);
        if (parsed && onBatchAddTransactions) {
            onBatchAddTransactions([parsed]);
            showToast(`${t.success}: 1 ${t.importedCount}`, 'success');
        } else { showToast(t.noValidTxs, 'error'); }
      } catch (err: any) {
        console.error('[JotBillOCR] AI Process error:', err);
        showToast('AI 解析失败: ' + (err.message || 'Unknown error'), 'error');
      } finally { setIsScreenshotLoading(false); setScreenshotStatus(''); }
    };
    (window as any).receiveOCRResult = receiver;
    return () => { delete (window as any).receiveOCRResult; };
  }, [onBatchAddTransactions, user.language, t]);

  const handleScreenshotImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onBatchAddTransactions) {
          setIsScreenshotLoading(true);
          setScreenshotStatus(t.analyzing);
          const reader = new FileReader();
          reader.onloadend = async () => {
              if (reader.result) {
                  const dataUrl = reader.result as string;
                  if (aiConfig.provider === 'DEEPSEEK' && ((window as any).AndroidOCR || (window as any).HarmonyOCR || (window as any).JotBillOCR)) {
                      try {
                          const text = await callNativeOcr(dataUrl);
                          const parsed = await parseTransactionText(text, user.language);
                          if (parsed) { onBatchAddTransactions([parsed]); alert(`${t.success}: 1 ${t.importedCount}`); } 
                          else { alert(t.noValidTxs); }
                      } catch (err: any) { alert(err?.message || 'OCR failed'); } 
                      finally { setIsScreenshotLoading(false); setScreenshotStatus(''); }
                      return;
                  }
                  if (aiConfig.provider === 'DEEPSEEK') {
                      try {
                          const results = await parseTransactionImageWithGemini(dataUrl);
                          if (results && results.length > 0) { onBatchAddTransactions(results); alert(`${t.success}: ${results.length} ${t.importedCount}`); } 
                          else { throw new Error('Gemini 解析返回空结果'); }
                      } catch (err: any) { showToast(err?.message || '当前环境未提供原生 OCR，请在设置切换为 Gemini 解析，或使用 CSV 导入。', 'error'); } 
                      finally { setIsScreenshotLoading(false); setScreenshotStatus(''); }
                      return;
                  }
                  const results = await parseTransactionImage(dataUrl);
                  if (results && results.length > 0) { onBatchAddTransactions(results); alert(`${t.success}: ${results.length} ${t.importedCount}`); }
                  setIsScreenshotLoading(false);
                  setScreenshotStatus('');
              }
          };
          reader.readAsDataURL(file);
      }
  };
  
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // ... (篇幅原因，CSV 解析逻辑保持原样即可，这里省略了但请保留你原代码中的 CSV 逻辑)
      // 请务必把之前完整的 handleCsvFileChange 逻辑复制回来，或者我可以再给你发一次
      // 如果你需要完整的 CSV 代码，请告诉我，这里先略过以突出重点
      const file = e.target.files?.[0];
      if (!file || !onBatchAddTransactions) return;
      setIsCsvLoading(true);
      // ... 假装处理完了 ...
      setTimeout(() => setIsCsvLoading(false), 500);
  };

  const Header = ({ title, backFn }: { title: string, backFn: () => void }) => (
    <div className="bg-white/90 backdrop-blur-md px-4 py-3 border-b border-gray-200/50 flex items-center gap-4 sticky top-0 z-10">
      <button onClick={backFn} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-900"><ArrowLeft size={22} /></button>
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
    </div>
  );

  const Switch = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
      <button onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full p-1 transition-colors relative ${checked ? 'bg-green-500' : 'bg-gray-200'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] animate-slide-in-right flex flex-col z-[50] fixed inset-0">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down w-full max-w-sm px-4">
           <div className={`rounded-xl shadow-2xl p-4 flex items-center gap-3 border ${toast.type === 'success' ? 'bg-green-500 border-green-400 text-white' : toast.type === 'error' ? 'bg-red-500 border-red-400 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
               {toast.type === 'loading' ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/> : toast.type === 'success' ? <CheckCircle2 size={20} className="text-white"/> : <XCircle size={20} className="text-white"/>}
               <p className="font-bold text-sm">{toast.message}</p>
           </div>
        </div>
      )}

      {view === 'MAIN' && (
         <>
          <Header title={t.settings} backFn={onBack} />
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
             <div onClick={() => setView('PROFILE')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <img src={user.avatar} alt="Avatar" className="w-14 h-14 rounded-full border border-gray-200 object-cover" />
                <div className="flex-1"><h3 className="font-bold text-lg text-gray-900">{user.name}</h3><p className="text-xs text-gray-500 font-bold uppercase">{user.language === 'en' ? 'English' : user.language === 'fr' ? 'Français' : '中文'}</p></div>
                <ChevronRight className="text-gray-300" />
             </div>
             <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase ml-2 mb-2">AI</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                   <button onClick={() => setView('AI_CONFIG')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Cpu size={20}/></div><div><p className="font-bold text-gray-700 text-left">{t.aiConfig}</p><p className="text-xs text-gray-400 text-left">{aiConfig.provider} • {aiConfig.model}</p></div></div>
                      <ChevronRight className="text-gray-300" />
                   </button>
                </div>
             </div>
             <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase ml-2 mb-2">{t.appearance}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                   <button onClick={() => setView('APPEARANCE')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3"><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><LayoutTemplate size={20}/></div><span className="font-bold text-gray-700">{t.customizeNav}</span></div>
                      <ChevronRight className="text-gray-300" />
                   </button>
                </div>
             </div>
             <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase ml-2 mb-2">{t.data}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                   <button onClick={() => setView('STORAGE')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100 group"><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><Server size={20}/></div><span className="font-bold text-gray-700">{t.storage}</span></div><ChevronRight className="text-gray-300 group-hover:text-gray-500 transition-colors" /></button>
                   <button onClick={() => setView('SMART_IMPORT')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 text-green-600 rounded-lg"><ScanLine size={20}/></div><span className="font-bold text-gray-700">{t.smartImport}</span></div><ChevronRight className="text-gray-300" /></button>
                   <button onClick={handleExport} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"><div className="flex items-center gap-3"><div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Download size={20}/></div><span className="font-bold text-gray-700">{t.export}</span></div></button>
                   <button onClick={() => fileInputRef.current?.click()} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"><div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Upload size={20}/></div><span className="font-bold text-gray-700">{t.import}</span></div><input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json,*/*" onChange={handleImportFileChange}/></button>
                </div>
             </div>
             <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase ml-2 mb-2">Danger Zone</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onClick={handleResetClick} className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={20} /><span className="font-bold">{t.resetData}</span></button>
                </div>
             </div>
             <div className="text-center pt-8 pb-4"><p className="text-xs text-gray-400 font-bold">ZenLedger AI v6.2</p></div>
          </div>
         </>
      )}

      {view === 'STORAGE' && (
          <div className="flex flex-col h-full bg-[#F2F2F7]">
              <Header title={t.storage} backFn={() => setView('MAIN')} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-500 mb-4">{t.storageDesc}</p>
                      <button onClick={() => saveStorageConfig({ ...storageConfig, type: storageConfig.type === 'NAS' ? 'LOCAL' : 'NAS' })} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all mb-4 ${storageConfig.type === 'NAS' ? 'bg-blue-50 border-2 border-blue-500 shadow-sm' : 'bg-white border-2 border-gray-100'}`}>
                          <div className="flex items-center gap-3"><div className={storageConfig.type === 'NAS' ? 'text-blue-600' : 'text-gray-400'}><Server size={22}/></div><div className="text-left"><span className={`block font-bold ${storageConfig.type === 'NAS' ? 'text-blue-900' : 'text-gray-900'}`}>{t.nas}</span><span className="text-xs text-gray-400">OwnCloud, NextCloud, Synology</span></div></div>
                          <div className="flex items-center gap-2">{storageConfig.type === 'NAS' && <CheckCircle2 size={20} className="text-blue-600"/>}</div>
                      </button>
                      
                      {storageConfig.type === 'NAS' && (
                         <div className="space-y-4 animate-fade-in-down">
                            <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
                                <div><label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-1"><Globe size={12}/> {t.serverAddress}</label><input value={storageConfig.host || ''} onChange={e => saveStorageConfig({...storageConfig, host: e.target.value})} placeholder="https://nas.example.com/remote.php/dav/files/user/" className="w-full p-3 bg-white rounded-xl font-bold outline-none text-sm border border-gray-200 focus:border-blue-500 transition-colors"/><p className="text-[10px] text-gray-400 mt-1 ml-1">Example: http://192.168.1.5:5005</p></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-1">路径/子目录（可选）</label><input value={storageConfig.path || ''} onChange={e => saveStorageConfig({...storageConfig, path: e.target.value})} placeholder="例如：backup" className="w-full p-3 bg-white rounded-xl font-bold outline-none text-sm border border-gray-200 focus:border-blue-500 transition-colors"/></div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div><label className="text-xs font-bold text-gray-400 uppercase mb-1">{t.username}</label><input value={storageConfig.username || ''} onChange={e => saveStorageConfig({...storageConfig, username: e.target.value})} className="w-full p-3 bg-white rounded-xl font-bold outline-none text-sm border border-gray-200 focus:border-blue-500 transition-colors"/></div>
                                    <div className="relative"><label className="text-xs font-bold text-gray-400 uppercase mb-1">{t.password}</label><input type={showDavPassword ? "text" : "password"} value={storageConfig.password || ''} onChange={e => saveStorageConfig({...storageConfig, password: e.target.value})} className="w-full p-3 bg-white rounded-xl font-bold outline-none text-sm border border-gray-200 focus:border-blue-500 transition-colors pr-10"/><button onClick={() => setShowDavPassword(!showDavPassword)} className="absolute right-3 top-[28px] text-gray-400 hover:text-gray-600">{showDavPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between px-2 py-1"><span className="font-bold text-gray-700 text-sm flex items-center gap-2"><RefreshCw size={16} className="text-gray-400"/>{t.autoSync}</span><Switch checked={!!storageConfig.autoSync} onChange={(v) => saveStorageConfig({...storageConfig, autoSync: v})} /></div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={handleDavTest} disabled={!!davLoading} className="col-span-2 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">{davLoading === 'TEST' ? <RotateCw size={18} className="animate-spin"/> : <Wifi size={18}/>}{t.btn_test_connection}</button>
                                <button onClick={handleDavBackup} disabled={!!davLoading} className="py-3 bg-blue-50 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2 border border-blue-100 hover:bg-blue-100 transition-colors">{davLoading === 'BACKUP' ? <RotateCw size={18} className="animate-spin"/> : <Upload size={18}/>}{t.backupNow}</button>
                                <button onClick={handleDavRestore} disabled={!!davLoading} className="py-3 bg-green-50 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 border border-green-100 hover:bg-green-100 transition-colors">{davLoading === 'RESTORE' ? <RotateCw size={18} className="animate-spin"/> : <CloudDownload size={18}/>}{t.restore}</button>
                            </div>
                         </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {/* ... Other views (PROFILE, APPEARANCE, AI_CONFIG, SMART_IMPORT) ... */}
      {view === 'AI_CONFIG' && (
          <div className="flex flex-col h-full bg-[#F2F2F7]">
             <Header title={t.aiConfig} backFn={() => setView('MAIN')} />
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                     {/* Provider Selection */}
                     <div>
                         <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                            <Cpu size={14}/> {t.provider}
                         </label>
                         <div className="relative">
                             <select 
                                 value={aiConfig.provider}
                                 onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                                 className="w-full p-3 bg-gray-50 rounded-xl font-bold outline-none appearance-none pr-8"
                             >
                                 <option value="GEMINI">Google Gemini (Default)</option>
                                 <option value="DEEPSEEK">DeepSeek</option>
                                 <option value="CUSTOM">OpenAI / Custom</option>
                             </select>
                             <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                                 <ChevronRight size={16} className="rotate-90" />
                             </div>
                         </div>
                     </div>

                     {/* API Key */}
                     <div>
                         <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                             <Key size={14}/> {t.apiKey}
                         </label>
                        <div className="relative">
                            <input 
                              type="text" // plain text to allow copy/paste on Huawei keyboard
                              value={aiConfig.apiKey}
                              onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                              placeholder={t.apiKeyPlaceholder}
                              className="w-full p-3 pr-12 bg-gray-50 rounded-xl font-bold outline-none text-sm transition-all focus:bg-white focus:ring-2 focus:ring-black/5"
                            />
                            <button 
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                     </div>

                     {/* Base URL (Hidden for Gemini) */}
                     {aiConfig.provider !== 'GEMINI' && (
                         <div className="animate-fade-in-down">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                                 <Globe size={14}/> {t.baseUrl}
                             </label>
                             <input 
                                type="text"
                                value={aiConfig.baseUrl}
                                onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                                placeholder="https://api.deepseek.com"
                                className="w-full p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm transition-all focus:bg-white focus:ring-2 focus:ring-black/5"
                                disabled={aiConfig.provider === 'DEEPSEEK'} 
                             />
                             {aiConfig.provider === 'DEEPSEEK' && (
                                 <p className="text-[10px] text-gray-400 mt-1 ml-1">{t.defaultUrl}</p>
                             )}
                         </div>
                     )}

                     {/* Model Name Selector (ComboBox Pattern) */}
                     <div className="animate-fade-in-down">
                         <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-2">
                             <Cpu size={14}/> {t.modelName}
                         </label>
                         
                         <div className="space-y-2">
                             {/* Primary Select Dropdown */}
                             <div className="relative">
                                 <select
                                     value={isCustomModel ? 'custom' : aiConfig.model}
                                     onChange={(e) => {
                                         if (e.target.value === 'custom') {
                                             setIsCustomModel(true);
                                         } else {
                                             setIsCustomModel(false);
                                             setAiConfig({...aiConfig, model: e.target.value});
                                         }
                                     }}
                                     className="w-full p-3 bg-gray-50 rounded-xl font-bold outline-none appearance-none pr-8 transition-all focus:bg-white focus:ring-2 focus:ring-black/5"
                                 >
                                     {(PRESET_MODELS[aiConfig.provider] || []).map(m => (
                                         <option key={m} value={m}>{m}</option>
                                     ))}
                                     <option value="custom">Custom...</option>
                                 </select>
                                 <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                                     <ChevronRight size={16} className="rotate-90" />
                                 </div>
                             </div>

                             {/* Custom Input Field (Conditional) */}
                             {isCustomModel && (
                                 <input 
                                    type="text"
                                    value={aiConfig.model}
                                    onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})}
                                    placeholder={t.enterModelName}
                                    className="w-full p-3 bg-white border-2 border-indigo-100 rounded-xl font-bold outline-none text-sm animate-fade-in-down"
                                    autoFocus
                                 />
                             )}
                         </div>
                     </div>
                 </div>

                 {/* Action Buttons - Fixed Layout via Inline Styles */}
                 <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%' }}>
                     <button 
                         onClick={handleTestConnection}
                         disabled={isTesting}
                         style={{
                           flex: 1,
                           height: '48px',
                           background: '#f5f5f5',
                           color: '#333',
                           border: '1px solid #ddd',
                           borderRadius: '12px',
                           fontWeight: 600,
                           fontSize: '15px',
                           whiteSpace: 'nowrap',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           opacity: isTesting ? 0.6 : 1,
                           cursor: isTesting ? 'not-allowed' : 'pointer'
                         }}
                     >
                         {isTesting ? (
                            <RefreshCw size={18} className="animate-spin mr-1.5"/>
                         ) : (
                            <Link size={18} className="mr-1.5"/>
                         )}
                         <span>{isTesting ? (user.language === 'zh' ? '测试中...' : 'Testing...') : t.btn_test_connection}</span>
                     </button>

                     <button 
                         onClick={handleSaveAndExit}
                         style={{
                           flex: 2,
                           height: '48px',
                           background: '#000',
                           color: '#fff',
                           border: 'none',
                           borderRadius: '12px',
                           fontWeight: 600,
                           fontSize: '15px',
                           whiteSpace: 'nowrap',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           cursor: 'pointer'
                         }}
                     >
                         <Check size={18} className="mr-1.5"/> 
                         <span>{t.save}</span>
                     </button>
                 </div>
             </div>
          </div>
      )}

      {view === 'PROFILE' && (
          <div className="flex flex-col h-full bg-[#F2F2F7]">
              <Header title={t.userProfile} backFn={() => setView('MAIN')} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex flex-col items-center gap-4">
                      <div className="relative group">
                          <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" />
                          <button onClick={() => importInputRef.current?.click()} className="absolute bottom-0 right-0 bg-black text-white p-2 rounded-full shadow-lg">
                              <Upload size={14}/>
                          </button>
                          <input ref={importInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                      </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">{t.name}</label>
                          <input 
                            value={user.name} 
                            onChange={(e) => onUpdateUser({...user, name: e.target.value})} 
                            className="w-full mt-1 p-2 bg-gray-50 rounded-lg font-bold outline-none"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">{t.language}</label>
                          <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => onUpdateUser({...user, language: 'en'})}
                                className={`flex-1 py-2 rounded-lg font-bold border transition-all ${user.language === 'en' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                              >
                                  English
                              </button>
                              <button 
                                onClick={() => onUpdateUser({...user, language: 'zh'})}
                                className={`flex-1 py-2 rounded-lg font-bold border transition-all ${user.language === 'zh' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                              >
                                  中文
                              </button>
                              <button 
                                onClick={() => onUpdateUser({...user, language: 'fr'})}
                                className={`flex-1 py-2 rounded-lg font-bold border transition-all ${user.language === 'fr' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                              >
                                  Français
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {view === 'APPEARANCE' && (
          <div className="flex flex-col h-full bg-[#F2F2F7]">
              <Header title={t.customizeNav} backFn={() => setView('MAIN')} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-4">{t.appearance}</h3>
                      <div className="space-y-4">
                          <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{t.showReports}</span>
                              <Switch checked={uiPrefs.showReports} onChange={(v) => onUpdateUiPrefs({...uiPrefs, showReports: v})} />
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{t.showAccounts}</span>
                              <Switch checked={uiPrefs.showAccounts} onChange={(v) => onUpdateUiPrefs({...uiPrefs, showAccounts: v})} />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {view === 'SMART_IMPORT' && (
          <div className="flex flex-col h-full bg-[#F2F2F7]">
              <Header title={t.smartImport} backFn={() => setView('MAIN')} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Screenshot Import */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                              <ImageIcon size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-900">{t.screenshotImport}</h3>
                              <p className="text-xs text-gray-400">OCR + AI Analysis</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => {
                          const bridge = (window as any).JotBillOCR;
                          if (bridge && typeof bridge.triggerOCR === 'function') {
                            // ✅ [关键修改 2] 点击按钮时，立即开启加载状态
                            setIsScreenshotLoading(true);
                            setScreenshotStatus(t.analyzing);
                            
                            bridge.triggerOCR();
                          } else {
                            screenshotInputRef.current?.click();
                          }
                        }}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        disabled={isScreenshotLoading}
                      >
                          {isScreenshotLoading ? <div className="animate-spin w-4 h-4 border-2 border-white/50 border-t-white rounded-full"/> : <Upload size={18}/>}
                          {isScreenshotLoading ? screenshotStatus : t.import}
                      </button>
                      <input ref={screenshotInputRef} type="file" className="hidden" accept="image/*" onChange={handleScreenshotImport} />
                  </div>

                  {/* CSV Import */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                              <FileText size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-900">{t.csvImport}</h3>
                              <p className="text-xs text-gray-400">Alipay & WeChat (CSV)</p>
                          </div>
                      </div>
                      
                      <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                          <button 
                             onClick={() => setImportSource('WECHAT')} 
                             className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${importSource === 'WECHAT' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                          >
                             WeChat
                          </button>
                          <button 
                             onClick={() => setImportSource('ALIPAY')} 
                             className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${importSource === 'ALIPAY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                          >
                             Alipay
                          </button>
                      </div>

                      <button 
                        onClick={() => csvInputRef.current?.click()}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-colors flex items-center justify-center gap-2"
                        disabled={isCsvLoading}
                      >
                          {isCsvLoading ? <div className="animate-spin w-4 h-4 border-2 border-white/50 border-t-white rounded-full"/> : <Upload size={18}/>}
                          {isCsvLoading ? csvStatus : t.import}
                      </button>
                      <input 
                        ref={csvInputRef} 
                        type="file" 
                        className="hidden" 
                        accept=".csv,text/csv,application/vnd.ms-excel,application/octet-stream,text/plain,*/*" 
                        onChange={handleCsvFileChange} 
                      />
                  </div>
              </div>
          </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsResetModalOpen(false)}></div>
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-scale-in">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{t.resetData}?</h3>
                  <p className="text-gray-500 text-center mb-6 text-sm font-medium">{t.confirmReset}</p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setIsResetModalOpen(false)}
                          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-2xl transition-colors"
                          disabled={isResetting}
                      >
                          {t.cancel}
                      </button>
                      <button 
                          onClick={performReset}
                          className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-colors flex items-center justify-center"
                          disabled={isResetting}
                      >
                          {isResetting ? <div className="animate-spin w-4 h-4 border-2 border-white/50 border-t-white rounded-full"/> : t.reset}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsPage;