<div align="center">
  <a href="https://github.com/shzbzjhsnsja/JotBill">
    <img src="./app_icon.png" alt="Logo" width="100" height="100">
  </a>

  <h1 align="center">小记一笔 (JotBill)</h1>

  <p align="center">
    <strong>极简 · 本地优先 · AI 智能记账</strong>
  </p>

  <p align="center">
    <a href="./README_CN.md">🇨🇳 中文文档</a>
    &nbsp; | &nbsp;
    <a href="./README.md">🇺🇸 English</a>
  </p>

  <p align="center">
    <a href="https://github.com/shzbzjhsnsja/JotBill/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
    </a>
    <a href="#">
      <img src="https://img.shields.io/badge/平台-Android-orange.svg" alt="Platform">
    </a>
    <a href="#">
      <img src="https://img.shields.io/badge/技术栈-TypeScript%20%7C%20Kotlin-blue.svg" alt="Tech Stack">
    </a>
  </p>
</div>

---

## 📖 项目简介

**小记一笔** 是一款极简、注重隐私的本地记账应用。

与市面上强制云同步的记账软件不同，小记一笔采用 **本地优先 (Local-First)** 架构，结合了原生安卓的高性能与 Web 技术的灵活性。

通过 **自带 Key (BYOK)** 的 AI 集成模式，你可以直接与你的账本对话，获取财务洞察，同时确保所有敏感数据完全掌握在你自己手中，绝不上传至开发者服务器。

## ✨ 核心功能

* **🔒 隐私优先:** 无服务器，无追踪，所有数据存储在本地 (IndexedDB + SQLite)。
* **🤖 AI 智能分析:** 支持配置 DeepSeek 及兼容 OpenAI 格式的 API。
* **🔑 BYOK 架构:** **Bring Your Own Key**。API Key 仅保存在你的本地设备，拥有完全控制权。
* **☁️ 私有云同步:** 支持 WebDAV 协议，轻松同步至 NextCloud、群晖 NAS 等私有云。
* **📥 智能导入:** * OCR 截图识别自动记账
    * 微信/支付宝账单 CSV 格式解析导入

## 📸 应用截图

<div align="center">
  <img src="screenshots/dashboard.png" width="30%" alt="Dashboard"/>
  <img src="screenshots/settings.png" width="30%" alt="Settings"/>
  <img src="screenshots/ai_config.png" width="30%" alt="AI Config"/>
</div>

## 🛠️ 技术栈

本项目采用了 **混合开发 (Hybrid)** 架构：

* **Android 原生壳:** Kotlin, Jetpack, WebView 交互。
* **核心逻辑 (Web):** TypeScript, HTML5, CSS3。
* **数据存储:** IndexedDB (Web 端) + SharedPreferences (Android 端)。
* **AI 集成:** 自封装的 LLM RESTful 接口调用。

## 🚀 快速开始

### 前置要求
* Android Studio Ladybug 或更高版本。
* Node.js & npm (用于编译 Web 核心)。

### 安装步骤

1.  **克隆仓库:**
    ```bash
    git clone [https://github.com/shzbzjhsnsja/JotBill.git](https://github.com/shzbzjhsnsja/JotBill.git)
    cd JotBill
    ```

2.  **运行应用:**
    * 使用 Android Studio 打开项目文件夹。
    * 同步 Gradle 并连接模拟器或真机运行。

## 🤝 参与贡献

非常欢迎提交 PR！如果是重大功能改动，请先提交 Issue 讨论。

## 📄 开源协议

本项目遵循 MIT 开源协议 - 详情请见 [LICENSE](LICENSE) 文件。
