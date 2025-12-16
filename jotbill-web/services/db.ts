

const DB_BASE_NAME = 'ZenLedgerDB';
const DB_NAME_KEY = 'zenledger_db_name';
const DB_VERSION = 7; // Bump version to force schema refresh if needed

const getDbName = () => {
  let name = localStorage.getItem(DB_NAME_KEY);
  if (!name) {
    name = DB_BASE_NAME;
    localStorage.setItem(DB_NAME_KEY, name);
  }
  return name;
};

export const STORES = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  LEDGERS: 'ledgers',
  USER: 'user', 
  SETTINGS: 'settings', 
};

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(getDbName(), DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      
      // Handle connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        console.warn("Database version changed. Connection closed.");
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      const storeNames = Object.values(STORES);

      // 1. Create Object Stores if they don't exist
      storeNames.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          if (name === STORES.USER || name === STORES.SETTINGS) {
             db.createObjectStore(name);
          } else {
             // Use 'id' as the key path for lists
             db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      });

      // 2. Data Migration for Version 6
      if (event.oldVersion < 6) {
        console.log("Migrating DB to Version 6: Adding mood and currency fields...");
        if (transaction && db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const store = transaction.objectStore(STORES.TRANSACTIONS);
          const cursorRequest = store.openCursor();
          
          cursorRequest.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
              const data = cursor.value;
              let changed = false;

              // Add default mood
              if (!data.mood) {
                data.mood = 'neutral';
                changed = true;
              }

              // Add default original currency/amount if missing
              if (data.original_currency === undefined) {
                // Default to 'CNY' as per requirement, or fallback to existing currency
                data.original_currency = 'CNY';
                data.original_amount = data.amount;
                data.exchange_rate = 1;
                changed = true;
              }

              if (changed) {
                cursor.update(data);
              }
              cursor.continue();
            }
          };
          
          cursorRequest.onerror = (e) => {
            console.error("Migration cursor error", e);
          };
        }
      }
    };
  });
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) return [];

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`Error getting all from ${storeName}:`, e);
    return [];
  }
};

export const getValue = async <T>(storeName: string, key: string): Promise<T | null> => {
  try {
    const db = await initDB();
    if (!db.objectStoreNames.contains(storeName)) return null;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result ? request.result as T : null);
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`Error getting value from ${storeName}:`, e);
    return null;
  }
};

export const saveList = async (storeName: string, items: any[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    // We use readwrite transaction
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      items.forEach(item => store.put(item));
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteItems = async (storeName: string, ids: string[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    ids.forEach(id => store.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const mergeList = async (storeName: string, items: any[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        items.forEach(item => {
            store.put(item); 
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// --- CORE FUNCTION: Add Single Item ---
export const addItem = async (storeName: string, item: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// EXPORT 'add' specifically for transactions as requested by user
export const add = async (item: any) => {
    return addItem(STORES.TRANSACTIONS, item);
};

export const saveValue = async (storeName: string, key: string, value: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getBackupData = async () => {
    try {
        const [transactions, accounts, categories, ledgers, userProfile, settings] = await Promise.all([
            getAll(STORES.TRANSACTIONS),
            getAll(STORES.ACCOUNTS),
            getAll(STORES.CATEGORIES),
            getAll(STORES.LEDGERS),
            getValue(STORES.USER, 'profile'),
            getValue(STORES.SETTINGS, 'storageConfig')
        ]);

        return {
            transactions,
            accounts,
            categories,
            ledgers,
            user: userProfile,
            settings: settings,
            exportDate: new Date().toISOString(),
            version: DB_VERSION
        };
    } catch (error) {
        console.error("Failed to gather backup data", error);
        throw error;
    }
};

export const resetDatabase = async (): Promise<void> => {
    // 保持兼容性：不再物理删除数据库，只清空各表，避免旧备份导入时被强制重建
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
    try {
        await clearAllStores();
        console.log("All stores cleared (resetDatabase).");
    } catch (e) {
        console.warn("clearAllStores failed during resetDatabase", e);
    }
};

// Safety helper: clear all stores without dropping the DB (used when delete is blocked)
export const clearAllStores = async (): Promise<void> => {
    const db = await initDB();
    const storeNames = Object.values(STORES);
    await Promise.all(
        storeNames.map(
            name =>
                new Promise<void>((resolve, reject) => {
                    if (!db.objectStoreNames.contains(name)) return resolve();
                    const tx = db.transaction(name, 'readwrite');
                    tx.objectStore(name).clear();
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                })
        )
    );
};

// 强制重建一个干净的空库：删除 -> 重新 init -> 清空所有表
export const rebuildEmptyDatabase = async (): Promise<void> => {
    // 0) 关闭现有连接
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }

    // 1) 切换到全新 DB 名称，绕过 delete 被阻塞的情况
    const newName = `${DB_BASE_NAME}_${Date.now()}`;
    localStorage.setItem(DB_NAME_KEY, newName);

    // 2) 重新打开 DB（新名字），这本身就是空库
    await initDB();

    // 3) 确保所有表存在且清空（防止旧结构残留）
    await clearAllStores();
};
