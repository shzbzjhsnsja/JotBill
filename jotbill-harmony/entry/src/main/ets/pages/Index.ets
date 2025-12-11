import { webview } from '@kit.ArkWeb';
import { textRecognition } from '@kit.CoreVisionKit';
import { image } from '@kit.ImageKit';
import { picker, fileIo as fs } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

// 1. 定义接口：包含 OCR 和 保存文件 两个功能
interface JotBillBridge {
  triggerOCR: () => void;
  saveFile: (fileName: string, content: string) => void;
  testConnection: () => string;
}

@Entry
@Component
struct Index {
  // === 配置区域 ===
  @State isLocalLoad: boolean = false;

  // ⚠️ 你的电脑 IP，真机调试时手机和电脑需在同一 WiFi
  @State remoteUrl: string = 'http://10.0.0.103:3000/';

  private controller: webview.WebviewController = new webview.WebviewController();

  // 2. 定义桥接对象
  private jsBridgeProxy: JotBillBridge = {
    triggerOCR: () => {
      this.selectImageAndRecognize();
    },
    saveFile: (fileName: string, content: string) => {
      this.handleSaveFile(fileName, content);
    },
    testConnection: () => {
      return "连接成功：鸿蒙原生端在线";
    }
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
          methodList: ["triggerOCR", "saveFile", "testConnection"],
          controller: this.controller
        })
        .width('100%')
        .height('100%')
    }
  }

  // === 功能 A: 真实 OCR 流程 (带资源释放 & 超时保护) ===
  async selectImageAndRecognize() {
    const TAG = '[JotBill-OCR] ';
    console.info(TAG + '1. 收到 Web 请求，准备调起相册');

    let file: fs.File | undefined = undefined;
    let imageSource: image.ImageSource | undefined = undefined;
    let pixelMap: image.PixelMap | undefined = undefined;

    try {
      // 1. 选图
      const photoSelectOptions = new picker.PhotoSelectOptions();
      photoSelectOptions.MIMEType = picker.PhotoViewMIMETypes.IMAGE_TYPE;
      photoSelectOptions.maxSelectNumber = 1;
      const photoViewPicker = new picker.PhotoViewPicker();

      const result = await photoViewPicker.select(photoSelectOptions);
      if (result.photoUris.length === 0) {
        // 通知 Web 取消
        this.controller.runJavaScript(`if(window.receiveOCRResult) window.receiveOCRResult('CANCEL');`);
        return;
      }

      const uri = result.photoUris[0];
      console.info(TAG + '2. 拿到图片路径: ' + uri);

      // 2. 读取文件并解码
      try {
        file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
        imageSource = image.createImageSource(file.fd);
        pixelMap = await imageSource.createPixelMap();
      } catch (fileErr) {
        let err = fileErr as BusinessError;
        throw new Error('图片读取失败: ' + err.message);
      }

      // 3. 竞速识别 (5秒超时保护)
      console.info(TAG + '3. 正在呼叫 CoreVisionKit...');
      const ocrPromise = textRecognition.recognizeText({ pixelMap: pixelMap });
      const timeoutPromise = new Promise<textRecognition.TextRecognitionResult>((_, reject) =>
      setTimeout(() => reject(new Error("OCR 请求超时(5s)，请检查设备 NPU 状态")), 5000)
      );

      const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
      let recognizedText = ocrResult.value;
      console.info(TAG + `4. 识别完成，长度: ${recognizedText.length}`);

      // 4. 回传结果
      if (!recognizedText) recognizedText = "未识别到文字";
      const safeText = JSON.stringify(recognizedText);
      this.controller.runJavaScript(`receiveOCRResult(${safeText})`);

    } catch (error) {
      // 错误处理
      let err = error as BusinessError;
      let errorMsg = err.message || JSON.stringify(error);
      console.error(TAG + '❌ 出错: ' + errorMsg);

      // 弹窗提示
      AlertDialog.show({
        title: '识别失败',
        message: `错误: ${errorMsg}\n(如果是模拟器，请换真机)`,
        confirm: { value: '关闭', action: () => {} }
      });

      // 通知 Web 停止转圈
      let safeMsg = errorMsg.replace(/'/g, "\\'");
      this.controller.runJavaScript(`alert('${safeMsg}'); if(window.receiveOCRResult) window.receiveOCRResult('ERROR');`);

    } finally {
      // 5. 内存清理 (必须)
      try {
        if (imageSource) imageSource.release();
        if (pixelMap) pixelMap.release();
        if (file) fs.closeSync(file);
      } catch (e) {}
    }
  }

  // === 功能 B: 文件导出 (保存 JSON) ===
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