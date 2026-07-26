# JMComic3-APK-NO-Ads
自用，JMComic3的去广告/美化版

真正的纯净版喵

请不要将项目文件用于盈利
## 特性说明
- **完全去除广告**：移除了所有应用内广告、等待页面、浮动广告。
- **暗色模式修复**：重写了暗色模式的状态同步逻辑，完美适配系统的深色主题切换。
- **移除游戏板块**：精简了底部导航栏，移除了游戏相关的路由和入口。


## 如何使用 / 下载
 [Releases](../../releases) 页面下载最新的 APK 安装包（苹果端请下载.mobileconfig文件）。

## 源码说明
此仓库包含的是解包并经过修改后的 APK 内部文件（React Chunks、资源文件等）。

重新打包时不要直接使用 `jar c0Mf`，否则容易把 `resources.arsc` 压缩错误，导致安装时报 `-2`。

建议流程：
- 使用 `zip`/Python 脚本重新打包，并确保 `resources.arsc` 与图片资源以 `STORED` 方式写入
- 使用 `zipalign` 做 4 字节对齐
- 使用 `apksigner` 进行 V1/V2 签名

## AI 技能包 — 一键去广告 / 去板块

逆向修改 APK 需要耗费大量人力物力：追踪 minified JS 中的广告链路、逐 chunk 修补、反复验证。为此，我们将整个修改流程打包为 **AI 可调用的 Skill**，接入支持 Skill 的 AI 编程工具即可自动化执行。

**Skill 位置**：[`skills/jmcomic-apk-mod/SKILL.md`](skills/jmcomic-apk-mod/SKILL.md)

**支持的两种模式**：
- **分支 A：仅去广告** — 清除所有广告（banner、闪屏、插屏、文字链接），保留游戏/电影板块
- **分支 B：去广告 + 去板块** — 在 A 基础上剔除游戏/电影路由、Tab 入口、孤儿 chunk

**直接使用**：将本仓库克隆到本地，在支持 Skill 的 AI 工具中调用 `jmcomic-apk-mod`，让 AI 按照 Skill 中的步骤自动完成修改。

> 即使不使用 AI 辅助，Skill 文档本身也是一份完整的逆向修改手册，包含广告链路追踪、实战踩坑、故障排查等内容。

## Star History

<a href="https://www.star-history.com/?repos=Tom6814%2FJMComic3-NO-Ads&type=timeline&legend=top-left">

 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
 </picture>
</a>


> 免责声明：本项目仅作技术学习/交流用途，请于下载后24小时内删除
