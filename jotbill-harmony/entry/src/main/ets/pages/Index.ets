import { webview } from '@kit.ArkWeb';
import { textRecognition } from '@kit.CoreVisionKit';
import { image } from '@kit.ImageKit';
import { picker, fileIo as fs } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';

interface JotBillBridge {
  triggerOCR: () => void;
  saveFile: (fileName: string, content: string) => void;
  davAction: (action: string, host: string, path: string, user: string, pass: string, body: string, insecure: string, cbId: string) => void;
  testConnection: () => string;
}

class WebResult {
  ok: boolean = false;
  message: string = "";
}

@Entry
@Component
struct Index {
  @State isLocalLoad: boolean = false;
  // ⚠️ 确认 IP
  @State remoteUrl: string = 'http://10.0.0.103:3000/';

  private controller: webview.WebviewController = new webview.WebviewController();

  private jsBridgeProxy: JotBillBridge = {
    triggerOCR: () => { this.selectImageAndRecognize(); },
    saveFile: (f, c) => { this.handleSaveFile(f, c); },
    davAction: (action, host, path, user, pass, body, insecure, cbId) => {
      this.handleWebDAV(action, host, path, user, pass, body, cbId);
    },
    testConnection: () => { return "鸿蒙在线"; }
  }

  build() {
    Column() {
      Web({
        src: this.isLocalLoad ? $rawfile('index.html') : this.remoteUrl,
        controller: this.controller
      })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .javaScriptProxy({
          object: this.jsBridgeProxy,
          name: "JotBillOCR",
          methodList: ["triggerOCR", "saveFile", "davAction", "testConnection"],
          controller: this.controller
        })
        .width('100%')
        .height('100%')
    }
  }

  // =======================================================
  // 功能 A: WebDAV 核心 (智能文件名兜底)
  // =======================================================
  async handleWebDAV(action: string, host: string, pathStr: string, user: string, pass: string, body: string, cbId: string) {
    console.info(`[JotBill-DAV] Action: ${action}, Path: ${pathStr}`);

    try {
      // 1. 基础 URL
      let fullUrl = host;
      if (!fullUrl.endsWith('/')) fullUrl += '/';

      // 拼接路径
      if (pathStr) {
        let cleanPath = pathStr.startsWith('/') ? pathStr.substring(1) : pathStr;
        fullUrl += cleanPath;
      }

      // 2. HTTP 方法与智能文件名修正
      let method = http.RequestMethod.GET;

      if (action === 'TEST') {
        method = http.RequestMethod.GET;
      }
      else if (action === 'UPLOAD') {
        method = http.RequestMethod.PUT;

        // 🟢🟢🟢 智能修正逻辑 🟢🟢🟢
        // 如果路径不是以 .json 结尾，说明 Web 端只传了目录，没传文件名
        // 这时候我们强制加上默认文件名，防止报 405
        if (!fullUrl.toLowerCase().endsWith('.json')) {
          if (!fullUrl.endsWith('/')) fullUrl += '/';
          fullUrl += 'backup_data.json';
          console.info('[JotBill-DAV] 自动追加默认文件名: ' + fullUrl);
        }
      }
      else if (action === 'RESTORE') {
        method = http.RequestMethod.GET;
        // 恢复时同理，如果没指定具体文件，就找默认文件
        if (!fullUrl.toLowerCase().endsWith('.json')) {
          if (!fullUrl.endsWith('/')) fullUrl += '/';
          fullUrl += 'backup_data.json';
        }
      }

      // 3. Auth
      let textEncoder = new util.TextEncoder();
      let authArr = textEncoder.encodeInto(`${user}:${pass}`);
      let base64Helper = new util.Base64Helper();
      let authBase64 = base64Helper.encodeToStringSync(authArr);

      // 4. Headers
      let httpRequest = http.createHttp();
      let myHeaders: Record<string, string> = {
        'Authorization': `Basic ${authBase64}`,
        'Content-Type': 'application/json'
      };

      let options: http.HttpRequestOptions = {
        method: method,
        header: myHeaders,
        expectDataType: http.HttpDataType.STRING,
        priority: 1
      };

      if (action === 'UPLOAD' && body) {
        options.extraData = body;
      }

      console.info(`[JotBill-DAV] Sending ${method} to ${fullUrl}`);
      const response = await httpRequest.request(fullUrl, options);
      console.info(`[JotBill-DAV] Response Code: ${response.responseCode}`);

      // 5. 结果判定
      // 405 仅在测试目录时算通过
      if ((response.responseCode >= 200 && response.responseCode < 300) || (action === 'TEST' && response.responseCode === 405)) {
        let successMsg = "Success";
        if (action === 'RESTORE') {
          if (typeof response.result === 'string') successMsg = response.result;
          else successMsg = JSON.stringify(response.result);
        }
        this.replyWebDAV(cbId, true, successMsg);
      } else {
        this.replyWebDAV(cbId, false, `HTTP Error: ${response.responseCode}`);
      }

    } catch (err) {
      let e = err as BusinessError;
      this.replyWebDAV(cbId, false, `Network Error: ${e.message}`);
    }
  }

  replyWebDAV(cbId: string, ok: boolean, message: string) {
    let payload = new WebResult();
    payload.ok = ok;
    payload.message = message;
    let jsonStr = JSON.stringify(payload);
    this.controller.runJavaScript(`if(window.__DAV_CB) window.__DAV_CB('${cbId}', ${jsonStr})`);
  }

  // === OCR (保留) ===
  async selectImageAndRecognize() {
    this.realOCRLogic();
  }

  async realOCRLogic() {
    try {
      const photoSelectOptions = new picker.PhotoSelectOptions();
      photoSelectOptions.MIMEType = picker.PhotoViewMIMETypes.IMAGE_TYPE;
      photoSelectOptions.maxSelectNumber = 1;
      const photoViewPicker = new picker.PhotoViewPicker();

      const result = await photoViewPicker.select(photoSelectOptions);
      if (result.photoUris.length === 0) {
        this.controller.runJavaScript(`if(window.receiveOCRResult) window.receiveOCRResult('CANCEL');`);
        return;
      }

      const uri = result.photoUris[0];
      let file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
      let imageSource = image.createImageSource(file.fd);
      let pixelMap = await imageSource.createPixelMap();

      const ocrPromise = textRecognition.recognizeText({ pixelMap: pixelMap });
      const timeoutPromise = new Promise<textRecognition.TextRecognitionResult>((_, reject) =>
      setTimeout(() => reject(new Error("OCR超时")), 5000)
      );

      const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
      let recognizedText = ocrResult.value || "未识别到文字";
      const safeText = JSON.stringify(recognizedText);
      this.controller.runJavaScript(`receiveOCRResult(${safeText})`);

      imageSource.release();
      pixelMap.release();
      fs.closeSync(file);

    } catch (e) {
      let err = e as BusinessError;
      this.controller.runJavaScript(`alert('${err.message}'); if(window.receiveOCRResult) window.receiveOCRResult('ERROR');`);
    }
  }

  // === 导出 (保留) ===
  async handleSaveFile(fileName: string, content: string) {
    try {
      const documentSaveOptions = new picker.DocumentSaveOptions();
      documentSaveOptions.newFileNames = [fileName];
      const documentViewPicker = new picker.DocumentViewPicker();
      const documentSaveResult = await documentViewPicker.save(documentSaveOptions);
      if (documentSaveResult.length > 0) {
        const uri = documentSaveResult[0];
        const file = fs.openSync(uri, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE);
        fs.writeSync(file.fd, content);
        fs.closeSync(file);
        this.controller.runJavaScript(`alert('✅ 导出成功！');`);
      }
    } catch (error) {
      let err = error as BusinessError;
      this.controller.runJavaScript(`alert('导出失败: ${err.message}');`);
    }
  }
}