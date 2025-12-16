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
            this.cancel()
            if (this.controller) {
              this.controller.close()
            }
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

// Bridge 接口定义
interface JotBillBridge {
  triggerOCR: () => void;
  saveFile: (fileName: string, content: string) => void;
  importFile: () => void;
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
  // ⚠️ 记得打包前确认这里是否需要改回 rawfile 或者是远程地址
  @State remoteUrl: string = 'http://10.0.0.103:5173/';

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
    customStyle: false,
    cancel: () => { this.onPrivacyCancel() }
  })

  aboutToAppear() {
    if (!this.hasAgreed) {
      this.dialogController.open();
    } else {
      console.info('用户之前已同意隐私协议，不再弹窗');
    }
  }

  // =======================================================
  // 核心修复：物理返回键处理 (防绕过隐私弹窗)
  // =======================================================
  onBackPress() {
    // 1. 如果没同意协议，按返回键直接杀进程
    if (!this.hasAgreed) {
      this.onPrivacyCancel();
      return true;
    }

    // 2. 正常返回逻辑
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

  private jsBridgeProxy: JotBillBridge = {
    triggerOCR: () => { this.realOCRLogic(); },
    saveFile: (f, c) => { this.handleSaveFile(f, c); },
    importFile: () => { this.handleImportFile(); },
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

  async handleImportFile() {
    try {
      const documentSelectOptions = new picker.DocumentSelectOptions();
      documentSelectOptions.maxSelectNumber = 1;
      documentSelectOptions.fileSuffixFilters = ['.json', '.txt', '*'];

      const documentViewPicker = new picker.DocumentViewPicker();
      const documentSelectResult = await documentViewPicker.select(documentSelectOptions);

      if (documentSelectResult && documentSelectResult.length > 0) {
        const uri = documentSelectResult[0];
        const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
        const arrayBuffer = new ArrayBuffer(4096000);
        const readLen = fs.readSync(file.fd, arrayBuffer);
        const content = util.TextDecoder.create('utf-8', { ignoreBOM: true }).decodeWithStream(new Uint8Array(arrayBuffer.slice(0, readLen)));
        fs.closeSync(file);
        this.webController.runJavaScript(`if(window.onNativeImportSuccess) window.onNativeImportSuccess(${JSON.stringify(content)});`);
      }
    } catch (err) {
      let e = err as BusinessError;
      this.webController.runJavaScript(`alert('导入出错: ${e.message}');`);
    }
  }

  // =======================================================
  // 🔥🔥🔥 核心修复：WebDAV 逻辑增强 🔥🔥🔥
  // =======================================================
  async handleWebDAV(action: string, host: string, pathStr: string, user: string, pass: string, body: string, cbId: string) {
    console.info(`[JotBill-DAV] Action: ${action}, Path: ${pathStr}`);
    try {
      let fullUrl = host;
      if (!fullUrl.endsWith('/')) fullUrl += '/';

      if (pathStr) {
        let cleanPath = pathStr.startsWith('/') ? pathStr.substring(1) : pathStr;
        // 🔥 修复：对路径进行编码，防止中文路径报错
        cleanPath = encodeURI(cleanPath);
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

      // 🔥🔥🔥 核心修复：允许 403/409/405 通过测试 🔥🔥🔥
      // 只要不是 401 (密码错)，其他状态码在测试连接时都算成功
      const isSuccess = (response.responseCode >= 200 && response.responseCode < 300);
      const isTestAllowed = action === 'TEST' && (
        response.responseCode === 405 ||
          response.responseCode === 403 || // 允许 Forbidden (坚果云根目录列表禁止)
          response.responseCode === 409    // 允许 Conflict
      );

      if (isSuccess || isTestAllowed) {
        let successMsg = "Success";
        if (action === 'RESTORE') successMsg = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
        this.replyWebDAV(cbId, true, successMsg);
      } else {
        // 只有 401 或其他错误才报失败
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

  async realOCRLogic() {
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
        message: `错误: ${errorMsg}\n(提示: 识别服务暂不可用，请手动记账)`,
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