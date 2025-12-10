
import { StorageConfig } from '../types';

/**
 * Uploads backup data to a WebDAV server via Android Interface or Web Fetch.
 * 
 * @param fileContent The JSON string content of the backup.
 * @param config The storage configuration containing host, username, password, etc.
 * @returns Promise<boolean> true if successful (or handled), false if failed.
 */
export const uploadBackup = async (fileContent: string, config: StorageConfig): Promise<boolean> => {
  // Environment Detection
  // @ts-ignore - Android interface injected by WebView
  const androidBridge = window.Android;
  const isAndroid = typeof androidBridge !== 'undefined';

  const targetUrl = config.host ? `${config.host}${config.path || '/backup.json'}` : '';

  if (isAndroid) {
    // --- BRANCH A: Android Hybrid Environment ---
    console.log("[Backup] Detected Android Environment. Using Native Interface.");
    try {
      if (androidBridge.uploadToWebDAV) {
        // Call Kotlin/Java Interface: uploadToWebDAV(url, username, password, content)
        androidBridge.uploadToWebDAV(
          targetUrl, 
          config.username || '', 
          config.password || '', 
          fileContent
        );
        return true; 
      } else {
        console.error("Android interface exists but uploadToWebDAV method is missing.");
        return false;
      }
    } catch (e) {
      console.error("Android native upload failed", e);
      return false;
    }
  } else {
    // --- BRANCH B: Pure Web Environment ---
    console.log("[Backup] Detected Web Environment. Using Fetch API.");
    
    try {
      if (!targetUrl) throw new Error("Missing Server Address");

      // Attempt Direct Upload
      const response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
          'Content-Type': 'application/json',
        },
        body: fileContent
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.status} ${response.statusText}`);
      }

      return true;

    } catch (error) {
      console.warn("[Backup] Web Direct Upload Failed (CORS/Mixed Content). Falling back to download.", error);

      // --- Auto Downgrade: Trigger Download ---
      try {
        const blob = new Blob([fileContent], { type: "application/json" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `backup_fallback_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        // Toast / Alert
        alert("Web 端因安全限制无法直连 NAS，已为您下载备份文件。");
      } catch (dlError) {
        console.error("Fallback download also failed", dlError);
      }

      return false;
    }
  }
};
