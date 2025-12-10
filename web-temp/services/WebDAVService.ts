
import { StorageConfig } from '../types';

const BACKUP_FILENAME = 'zenledger_backup.json';

const getAuthHeader = (config: StorageConfig) => {
    return 'Basic ' + btoa(`${config.username}:${config.password}`);
};

const trimSlash = (v: string) => v.replace(/\/+$/, '');
const trimLeadingSlash = (v: string) => v.replace(/^\/+/, '');
const withTrailingSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

const getBaseUrl = (config: StorageConfig) => {
    const host = config.host ? trimSlash(config.host) : '';
    const path = config.path ? trimLeadingSlash(trimSlash(config.path)) : '';
    if (!host) return '';
    return path ? `${host}/${path}` : host;
};

/**
 * Tests WebDAV connection by performing a simple GET on the root (某些设备不接受 PROPFIND).
 */
export const testWebDAVConnection = async (config: StorageConfig): Promise<boolean> => {
    if (!config.host) throw new Error("Missing Host URL");

    const url = withTrailingSlash(getBaseUrl(config));

    try {
        const response = await fetch(url, {
            method: 'GET', // some NAS block PROPFIND
            headers: {
                'Authorization': getAuthHeader(config)
            }
        });

        // 200 OK or 207 Multi-Status are good. 401 means auth failed but reached server.
        if (response.status === 200 || response.status === 207) {
            return true;
        } else if (response.status === 401) {
            throw new Error("401 Unauthorized: Check username/password.");
        } else {
            throw new Error(`Server returned status: ${response.status}`);
        }
    } catch (error) {
        console.error("WebDAV Test Failed:", error);
        // Throw specific message for CORS
        if ((error as Error).message.includes('Failed to fetch')) {
            throw new Error("连接失败，可能是 CORS（浏览器拦截跨域）或 NAS 不可达，请检查 NAS 允许跨域或使用 HTTPS。");
        }
        throw error;
    }
};

/**
 * Uploads JSON content to WebDAV.
 * Uses HTTP PUT.
 */
export const uploadToWebDAV = async (config: StorageConfig, jsonContent: string): Promise<void> => {
    if (!config.host) throw new Error("Missing Host URL");

    const url = `${withTrailingSlash(getBaseUrl(config))}${BACKUP_FILENAME}`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': getAuthHeader(config),
                'Content-Type': 'application/json'
            },
            body: jsonContent
        });

        if (!response.ok) {
             // 201 Created or 204 No Content is success for PUT usually
             if (response.status !== 201 && response.status !== 204) {
                 throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
             }
        }
    } catch (error) {
        console.error("WebDAV Upload Failed:", error);
         if ((error as Error).message.includes('Failed to fetch')) {
            throw new Error("上传失败，可能是 CORS 限制或网络错误。");
        }
        throw error;
    }
};

/**
 * Downloads JSON content from WebDAV.
 * Uses HTTP GET.
 */
export const restoreFromWebDAV = async (config: StorageConfig): Promise<any> => {
    if (!config.host) throw new Error("Missing Host URL");

    const url = `${withTrailingSlash(getBaseUrl(config))}${BACKUP_FILENAME}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getAuthHeader(config),
            }
        });

        if (!response.ok) {
            throw new Error(`Restore failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;

    } catch (error) {
        console.error("WebDAV Restore Failed:", error);
         if ((error as Error).message.includes('Failed to fetch')) {
            throw new Error("恢复失败，可能是 CORS 限制或网络错误。");
        }
        throw error;
    }
};
