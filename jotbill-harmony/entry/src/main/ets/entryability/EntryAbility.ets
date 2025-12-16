import { AbilityConstant, ConfigurationConstant, UIAbility, Want, Configuration } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onCreate');

    // 🔥🔥🔥 核心步骤 1: 初始化深色模式状态 🔥🔥🔥
    // 获取当前系统的颜色模式，并存入 AppStorage 全局存储中
    // Index.ets 会通过 @StorageLink('currentColorMode') 读取这个值
    const colorMode = this.context.config.colorMode;
    AppStorage.setOrCreate('currentColorMode', colorMode);
    hilog.info(DOMAIN, 'testTag', 'Initial Color Mode detected: %{public}d', colorMode);

    try {
      // 保持应用跟随系统设置 (System Default)
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, 'testTag', 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }
  }

  // 🔥🔥🔥 核心步骤 2: 监听系统深色模式切换 🔥🔥🔥
  // 当用户在手机控制中心切换深色/浅色模式时，系统会调用这个方法
  onConfigurationUpdate(newConfig: Configuration): void {
    // 获取新的颜色模式
    const newColorMode = newConfig.colorMode;

    // 更新 AppStorage
    // 这会瞬间触发 Index.ets 里的 @Watch('onColorModeChange')，从而通知 Web 变色
    AppStorage.setOrCreate('currentColorMode', newColorMode);

    hilog.info(DOMAIN, 'testTag', 'System Configuration Updated. New Color Mode: %{public}d', newColorMode);
  }

  onDestroy(): void {
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    // Main window is created, set main page for this ability
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageCreate');

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'testTag', 'Succeeded in loading the content.');
    });
  }

  onWindowStageDestroy(): void {
    // Main window is destroyed, release UI related resources
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    // Ability has brought to foreground
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onForeground');
  }

  onBackground(): void {
    // Ability has back to background
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onBackground');
  }
}