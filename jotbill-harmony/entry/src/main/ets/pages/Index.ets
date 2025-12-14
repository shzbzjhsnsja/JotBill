import { webview } from '@kit.ArkWeb';
import { textRecognition } from '@kit.CoreVisionKit';
import { image } from '@kit.ImageKit';
import { picker, fileIo as fs } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';
import { promptAction } from '@kit.ArkUI';

// 1. 初始化持久化存储
PersistentStorage.persistProp('hasAgreedPrivacy', false);

// ==========================================
// 隐私政策弹窗组件
// ==========================================
@CustomDialog
struct PrivacyDialog {
  controller: CustomDialogController
  confirm: () => void = () => {}
  cancel: () => void = () => {}

  build() {
    Column() {
      Text('欢迎使用小记一笔')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 24, bottom: 12 })

      Text('    请您在使用前仔细阅读《用户协议》与《隐私政策》。\n    我们需要访问您的相册图片进行小票识别与头像设置，使用网络连接您的 WebDAV 进行数据备份、获取实时汇率，以及连接 DeepSeek 进行智能分析。')
        .fontSize(16)
        .fontColor('#333333')
        .margin({ bottom: 20, left: 20, right: 20 })
        .lineHeight(24)

      Text('点击阅读详细隐私政策 >>')
        .fontSize(14)
        .fontColor('#0A59F7')
        .onClick(() => {
          const context = getContext(this) as common.UIAbilityContext;
          context.startAbility({
            action: 'ohos.want.action.viewData',
            entities: ['entity.system.browsable'],
            uri: 'https://wvd4r1fvutb.feishu.cn/wiki/EhTFwM3GCimFp3kynEWcpVudnUi?from=from_copylink'
          });
        })
        .margin({ bottom: 30 })

      Row() {
        Button('不同意并退出')
          .fontColor('#666666')
          .backgroundColor('#F2F2F2')
          .onClick(() => {
            if (this.controller) {
              this.controller.close()
            }
            this.cancel()
          })
          .width('40%')
          .height(40)

        Button('同意并继续')
          .fontColor(Color.White)
          .backgroundColor('#0A59F7')
          .onClick(() => {
            if (this.controller) {
              this.controller.close()
            }
            this.confirm()
          })
          .width('40%')
          .height(40)
      }
      .justifyContent(FlexAlign.SpaceEvenly)
      .width('100%')
      .margin({ bottom: 24 })
    }
    .backgroundColor(Color.White)
    .borderRadius(24)
    .width('90%')
  }
}

// 🔥🔥🔥 1. 更新 Bridge 接口，增加 importFile 🔥🔥🔥
interface JotBillBridge {
  triggerOCR: () => void;
  saveFile: (fileName: string, content: string) => void;
  importFile: () => void; // 新增：原生导入文件
  davAction: (action: string, host: string, path: string, user: string, pass: string, body: string, insecure: string, cbId: string) => void;
  testConnection: () => string;
  exitApp: () => void;
}

class WebResult {
  ok: boolean = false;
  message: string = "";
}

interface IRenderExitedEvent {
  renderExitReason: number;
}

@Entry
@Component
struct Index {
  @State isLocalLoad: boolean = false;
  @State remoteUrl: string = 'http://10.0.0.103:5173/'; // ⚠️ 请改为你的实际地址

  @State lastExitRequestTime: number = 0;

  private webController: webview.WebviewController = new webview.WebviewController();

  @StorageLink('hasAgreedPrivacy') hasAgreed: boolean = false;

  dialogController: CustomDialogController = new CustomDialogController({
    builder: PrivacyDialog({
      cancel: () => { this.onPrivacyCancel() },
      confirm: () => { this.onPrivacyConfirm() }
    }),
    autoCancel: false,
    alignment: DialogAlignment.Center,
    customStyle: false
  })

  aboutToAppear() {
    if (!this.hasAgreed) {
      this.dialogController.open();
    } else {
      console.info('用户之前已同意隐私协议，不再弹窗');
    }
  }

  // 物理返回键处理
  onBackPress() {
    this.webController.runJavaScript('if(window.dispatchBackKey) window.dispatchBackKey();');
    return true;
  }

  handleAppExit() {
    const currentTime = new Date().getTime();
    if (currentTime - this.lastExitRequestTime < 2000) {
      const context = getContext(this) as common.UIAbilityContext;
      context.terminateSelf();
    } else {
      this.lastExitRequestTime = currentTime;
      promptAction.showToast({
        message: '再按一次退出应用',
        duration: 2000,
        bottom: 100
      });
    }
  }

  onPrivacyCancel() {
    const context = getContext(this) as common.UIAbilityContext;
    context.terminateSelf();
  }

  onPrivacyConfirm() {
    this.hasAgreed = true;
    console.info('用户首次同意隐私协议');
  }

  // 🔥🔥🔥 2. 注册方法到 Bridge 🔥🔥🔥
  private jsBridgeProxy: JotBillBridge = {
    triggerOCR: () => { this.realOCRLogic(); },
    saveFile: (f, c) => { this.handleSaveFile(f, c); },
    importFile: () => { this.handleImportFile(); }, // 新增
    davAction: (action, host, path, user, pass, body, insecure, cbId) => {
      this.handleWebDAV(action, host, path, user, pass, body, cbId);
    },
    testConnection: () => { return "鸿蒙原生端在线"; },
    exitApp: () => { this.handleAppExit(); }
  }

  build() {
    Column() {
      Web({
        src: this.isLocalLoad ? $rawfile('index.html') : this.remoteUrl,
        controller: this.webController
      })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .onlineImageAccess(true)
        .javaScriptProxy({
          object: this.jsBridgeProxy,
          name: "JotBillOCR",
          // 🔥 别忘了把 importFile 加进去
          methodList: ["triggerOCR", "saveFile", "importFile", "davAction", "testConnection", "exitApp"],
          controller: this.webController
        })
        .onRenderExited((event: IRenderExitedEvent) => {
          console.error('[Webview] 渲染进程崩溃/退出 Reason Code: ' + event.renderExitReason);
          if (this.webController) {
            this.webController.loadUrl(this.isLocalLoad ? $rawfile('index.html') : this.remoteUrl);
          }
        })
        .width('100%')
        .height('100%')
    }
  }

  // =======================================================
  // 🔥🔥🔥 3. 新增：原生文件导入逻辑 (解决导入无效问题) 🔥🔥🔥
  // =======================================================
  async handleImportFile() {
    try {
      const documentSelectOptions = new picker.DocumentSelectOptions();
      documentSelectOptions.maxSelectNumber = 1;
      // 允许选择 JSON 或所有文件，避免文件变灰选不了
      documentSelectOptions.fileSuffixFilters = ['.json', '.txt', '*'];

      const documentViewPicker = new picker.DocumentViewPicker();
      const documentSelectResult = await documentViewPicker.select(documentSelectOptions);

      if (documentSelectResult && documentSelectResult.length > 0) {
        const uri = documentSelectResult[0];
        const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);

        // 读取文件内容
        const arrayBuffer = new ArrayBuffer(4096000); // 4MB buffer (根据需要调整)
        const readLen = fs.readSync(file.fd, arrayBuffer);
        const content = util.TextDecoder.create('utf-8', { ignoreBOM: true }).decodeWithStream(new Uint8Array(arrayBuffer.slice(0, readLen)));

        fs.closeSync(file);

        // 将内容传回 React
        // 注意：如果文件极大(>5MB)，runJavaScript 可能会失败，但一般备份文件还好
        // 使用 JSON.stringify 包装 content，防止换行符等破坏 JS 语法
        this.webController.runJavaScript(`if(window.onNativeImportSuccess) window.onNativeImportSuccess(${JSON.stringify(content)});`);
      }
    } catch (err) {
      let e = err as BusinessError;
      // 告诉 React 失败了
      this.webController.runJavaScript(`alert('导入出错: ${e.message}');`);
    }
  }

  // ... (WebDAV 和 OCR 逻辑保持不变) ...
  async handleWebDAV(action: string, host: string, pathStr: string, user: string, pass: string, body: string, cbId: string) {
    // ... 代码省略，保持原样 ...
    console.info(`[JotBill-DAV] Action: ${action}, Path: ${pathStr}`);
    try {
      let fullUrl = host;
      if (!fullUrl.endsWith('/')) fullUrl += '/';
      if (pathStr) {
        let cleanPath = pathStr.startsWith('/') ? pathStr.substring(1) : pathStr;
        fullUrl += cleanPath;
      }

      let method = http.RequestMethod.GET;
      if (action === 'TEST') {
        method = http.RequestMethod.GET;
      } else if (action === 'UPLOAD') {
        method = http.RequestMethod.PUT;
        if (!fullUrl.toLowerCase().endsWith('.json')) {
          if (!fullUrl.endsWith('/')) fullUrl += '/';
          fullUrl += 'backup_data.json';
        }
      } else if (action === 'RESTORE') {
        method = http.RequestMethod.GET;
        if (!fullUrl.toLowerCase().endsWith('.json')) {
          if (!fullUrl.endsWith('/')) fullUrl += '/';
          fullUrl += 'backup_data.json';
        }
      }

      let textEncoder = new util.TextEncoder();
      let authArr = textEncoder.encodeInto(`${user}:${pass}`);
      let base64Helper = new util.Base64Helper();
      let authBase64 = base64Helper.encodeToStringSync(authArr);

      let httpRequest = http.createHttp();
      let myHeaders: Record<string, string> = {
        'Authorization': `Basic ${authBase64}`,
        'Content-Type': 'application/json'
      };

      let options: http.HttpRequestOptions = {
        method: method, header: myHeaders, expectDataType: http.HttpDataType.STRING, priority: 1
      };
      if (action === 'UPLOAD' && body) options.extraData = body;

      const response = await httpRequest.request(fullUrl, options);

      if ((response.responseCode >= 200 && response.responseCode < 300) || (action === 'TEST' && response.responseCode === 405)) {
        let successMsg = "Success";
        if (action === 'RESTORE') successMsg = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
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
    this.webController.runJavaScript(`if(window.__DAV_CB) window.__DAV_CB('${cbId}', ${JSON.stringify(payload)})`);
  }

  // ... (OCR 逻辑保持不变) ...
  async realOCRLogic() {
    // ... 代码省略，保持原样 ...
    let file: fs.File | undefined = undefined;
    let imageSource: image.ImageSource | undefined = undefined;
    let pixelMap: image.PixelMap | undefined = undefined;

    try {
      const photoSelectOptions = new picker.PhotoSelectOptions();
      photoSelectOptions.MIMEType = picker.PhotoViewMIMETypes.IMAGE_TYPE;
      photoSelectOptions.maxSelectNumber = 1;
      const photoViewPicker = new picker.PhotoViewPicker();

      const result = await photoViewPicker.select(photoSelectOptions);
      if (result.photoUris.length === 0) {
        this.webController.runJavaScript(`if(window.receiveOCRResult) window.receiveOCRResult('CANCEL');`);
        return;
      }
      file = fs.openSync(result.photoUris[0], fs.OpenMode.READ_ONLY);
      imageSource = image.createImageSource(file.fd);
      pixelMap = await imageSource.createPixelMap();

      const ocrPromise = textRecognition.recognizeText({ pixelMap: pixelMap });
      const timeoutPromise = new Promise<textRecognition.TextRecognitionResult>((_, reject) =>
      setTimeout(() => reject(new Error("OCR超时(5s)")), 5000)
      );

      const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
      let recognizedText = ocrResult.value;

      if (!recognizedText) recognizedText = "未识别到文字";
      const safeText = JSON.stringify(recognizedText);
      this.webController.runJavaScript(`receiveOCRResult(${safeText})`);

    } catch (error) {
      let err = error as BusinessError;
      let errorMsg = err.message || JSON.stringify(error);

      AlertDialog.show({
        title: '识别失败',
        message: `错误: ${errorMsg}\n(提示: 模拟器无法使用 OCR，请使用真机)`,
        confirm: { value: '关闭', action: () => {} }
      });

      let safeMsg = errorMsg.replace(/'/g, "\\'");
      this.webController.runJavaScript(`alert('${safeMsg}'); if(window.receiveOCRResult) window.receiveOCRResult('ERROR');`);

    } finally {
      try {
        if (imageSource) imageSource.release();
        if (pixelMap) pixelMap.release();
        if (file) fs.closeSync(file);
      } catch (e) {}
    }
  }

  // ==========================================
  // 功能 C: 导出文件 (已增加提示)
  // ==========================================
  async handleSaveFile(fileName: string, content: string) {
    try {
      const documentSaveOptions = new picker.DocumentSaveOptions();
      documentSaveOptions.newFileNames = [fileName];
      const documentViewPicker = new picker.DocumentViewPicker();
      const documentSaveResult = await documentViewPicker.save(documentSaveOptions);
      if (documentSaveResult.length > 0) {
        const file = fs.openSync(documentSaveResult[0], fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
        fs.writeSync(file.fd, content, { encoding: 'utf-8' });
        fs.closeSync(file);

        // 🔥 使用 Toast 提示导出成功，更明显
        promptAction.showToast({
          message: '导出成功！文件已保存',
          duration: 3000
        });
        this.webController.runJavaScript(`alert('✅ 备份导出成功！');`);
      }
    } catch (error) {
      let err = error as BusinessError;
      this.webController.runJavaScript(`alert('导出失败: ${err.message}');`);
    }
  }
}