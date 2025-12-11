/**
 * Web 端调用 DeepSeek OCR 的完整示例代码
 * 这些代码片段可以集成到 React/Vue 组件中
 */

// ===== React 组件示例 =====
import React, { useState } from 'react';
import { parseOCRText, testDeepSeekConnection } from '../services/deepseekService';

export const DeepSeekOCRComponent = () => {
  const [ocrText, setOcrText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. 从 Canvas 获取图片 Base64
  const getImageFromCanvas = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 2. 调用鸿蒙 App 的 OCR 接口
  const handleOCRFromApp = async (file: File) => {
    try {
      setLoading(true);
      setError('');

      const base64 = await getImageFromCanvas(file);

      // 调用鸿蒙 App 的 OCR + DeepSeek 分析
      if (window.AppBridge && window.AppBridge.ocrAndAnalyze) {
        // 将 Web 端保存的 AI 配置（zenledger_ai_config）传给鸿蒙端，避免鸿蒙端重复维护配置
        const aiConfig = localStorage.getItem('zenledger_ai_config');
        const response = await window.AppBridge.ocrAndAnalyze(base64, aiConfig || undefined);
        const parsed = JSON.parse(response);

        if (parsed.ok) {
          setOcrText(parsed.ocrText);
          setResult(parsed.aiAnalysis);
        } else {
          setError(parsed.error);
        }
      } else {
        // 降级：使用 Web 端 DeepSeek 服务
        const json = await parseOCRText(ocrText);
        setResult(json);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 3. 配置 DeepSeek API Key
  const handleConfigureDeepSeek = (apiKey: string, baseUrl?: string, model?: string) => {
    if (window.AppBridge && window.AppBridge.configureDeepSeek) {
      const response = window.AppBridge.configureDeepSeek(apiKey, baseUrl || '', model || '');
      const parsed = JSON.parse(response);
      if (parsed.ok) {
        alert('DeepSeek 配置成功!');
      } else {
        alert('配置失败: ' + parsed.error);
      }
    }
  };

  // 4. 测试连接
  const handleTestConnection = async () => {
    try {
      if (window.AppBridge && window.AppBridge.testDeepSeekConnection) {
        const response = await window.AppBridge.testDeepSeekConnection();
        const parsed = JSON.parse(response);
        if (parsed.ok) {
          alert('连接成功!');
        } else {
          alert('连接失败: ' + parsed.error);
        }
      }
    } catch (err) {
      alert('测试失败: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>DeepSeek OCR 识别</h2>

      {/* 文件上传 */}
      <div style={{ marginBottom: '20px' }}>
        <label>选择图片：</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleOCRFromApp(e.target.files[0]);
            }
          }}
        />
      </div>

      {/* 配置区域 */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>DeepSeek 配置</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="password"
            placeholder="API Key"
            id="apiKey"
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Base URL (默认: https://api.deepseek.com/v1)"
            id="baseUrl"
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Model (默认: deepseek-chat)"
            id="model"
          />
        </div>
        <button
          onClick={() => {
            const apiKey = (document.getElementById('apiKey') as HTMLInputElement)?.value;
            const baseUrl = (document.getElementById('baseUrl') as HTMLInputElement)?.value;
            const model = (document.getElementById('model') as HTMLInputElement)?.value;
            handleConfigureDeepSeek(apiKey, baseUrl, model);
          }}
          style={{ marginRight: '10px' }}
        >
          保存配置
        </button>
        <button onClick={handleTestConnection}>测试连接</button>
      </div>

      {/* 加载状态 */}
      {loading && <p>处理中...</p>}

      {/* 错误显示 */}
      {error && <p style={{ color: 'red' }}>错误: {error}</p>}

      {/* OCR 结果 */}
      {ocrText && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5' }}>
          <h3>OCR 识别结果:</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{ocrText}</pre>
        </div>
      )}

      {/* AI 分析结果 */}
      {result && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e8f5e9' }}>
          <h3>DeepSeek 分析结果:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// ===== 类型定义 =====
declare global {
  interface Window {
    AppBridge?: {
      callNative: (msg: string) => string;
      ocrAndAnalyze: (base64: string, aiConfigJson?: string) => Promise<string>;
      configureDeepSeek: (apiKey: string, baseUrl?: string, model?: string) => string;
      testDeepSeekConnection: () => Promise<string>;
    };
  }
}

// ===== 纯 JavaScript 调用示例 =====
export const deepseekOCRExample = {
  /**
   * 调用应用 OCR + DeepSeek 分析
   */
  async recognizeImage(file: File) {
    try {
      // 1. 转换为 Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. 调用应用
      if (!window.AppBridge?.ocrAndAnalyze) {
        throw new Error('应用未初始化');
      }

      const aiConfig = localStorage.getItem('zenledger_ai_config');
      const response = await window.AppBridge.ocrAndAnalyze(base64, aiConfig || undefined);
      const data = JSON.parse(response);

      return data;
    } catch (error) {
      console.error('OCR 失败:', error);
      throw error;
    }
  },

  /**
   * 配置 DeepSeek
   */
  configure(apiKey: string, options?: { baseUrl?: string; model?: string }) {
    if (!window.AppBridge?.configureDeepSeek) {
      throw new Error('应用未初始化');
    }

    const response = window.AppBridge.configureDeepSeek(
      apiKey,
      options?.baseUrl || '',
      options?.model || ''
    );
    const data = JSON.parse(response);

    if (!data.ok) {
      throw new Error(data.error);
    }

    return data;
  },

  /**
   * 测试连接
   */
  async test() {
    if (!window.AppBridge?.testDeepSeekConnection) {
      throw new Error('应用未初始化');
    }

    const response = await window.AppBridge.testDeepSeekConnection();
    const data = JSON.parse(response);

    if (!data.ok) {
      throw new Error(data.error);
    }

    return data;
  }
};
