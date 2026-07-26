# 😘 JMComic3-APK-NO-Ads

如题，本项目是 JMComic3 的去广告 / 优化版

真正的纯净版喵

请不要将项目文件用于盈利哦

---

## ✨ 特性说明

- 🚫 **完全去除广告** — 移除所有应用内广告、等待页面、浮动广告
- 🌗 **暗色模式修复** — 重写暗色模式状态同步逻辑，完美适配系统深色主题切换
- 🎮 **移除游戏/小电影板块** — 精简体验，移除游戏/小电影相关路由和入口
- 🥰 **AI Skills** - 配有专门的 JMComic3 APK 逆向/去广告Skill，支持自己修改
---

## 📥 如何使用 / 下载

👉 [Releases](../../releases) 页面下载最新 APK 安装包（iOS 请下载 `.mobileconfig` 文件）

---

## 🛠️ 自己修改 / 逆向 — Skill 一键去广告·去板块

逆向修改 APK 需要耗费大量人力：追踪 minified JS 中的广告链路、逐 chunk 修补、反复验证。为此，我将整个修改流程打包为 **AI 可调用的 Skill**，接入支持 Skill 的 AI 编程工具即可自动化执行。

📂 AI Skill 存放在专属仓库：

→ **[Tom6814/jmcomic-apk-mod-skill](https://github.com/Tom6814/jmcomic-apk-mod-skill)**

```bash
git clone https://github.com/Tom6814/jmcomic-apk-mod-skill.git
```

支持两种模式：**仅去广告**（保留游戏/电影） / **去广告 + 去板块**

> Skill 文件同时包含在本仓库 [`skills/`](skills/jmcomic-apk-mod/SKILL.md) 目录下作为参考（不参与 APK 打包）。
> 即使不用 AI，Skill 文档本身也是一份完整的逆向修改手册，包含广告链路追踪、实战踩坑、故障排查等内容。

---

## 📦 源码说明

此仓库包含解包并经过修改后的 APK 内部文件（React Chunks、资源文件等）。

⚡ 重新打包时**不要**使用 `jar c0Mf`，否则 `resources.arsc` 可能被错误压缩，导致安装报 `-2`。

✅ 建议流程：
- 使用 `zip` / Python 脚本重新打包，确保 `resources.arsc` 与图片资源以 `STORED` 方式写入
- 使用 `zipalign` 做 4 字节对齐
- 使用 `apksigner` 进行 V1/V2 签名

---

## ⭐ Star History

<a href="https://www.star-history.com/?repos=Tom6814%2FJMComic3-NO-Ads&type=timeline&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
 </picture>
</a>
