# JMComic3-APK-NO-Ads
自用，JMComic3的去广告版。

## 特性说明
- **完全去除广告**：移除了所有应用内广告、等待页面、浮动广告。
- **暗色模式修复**：重写了暗色模式的状态同步逻辑，完美适配系统的深色主题切换。
- **移除游戏板块**：精简了底部导航栏，移除了游戏相关的路由和入口。
- **防封处理**：旧版使用自定义包名；新版 `v2.0.21` 官方已改为随机包名，继续具备更强的规避能力。

## 如何使用 / 下载
 [Releases](../../releases) 页面下载最新的 APK 安装包（苹果端请下载.mobileconfig文件）。

## 源码说明
此仓库包含的是解包并经过修改后的 APK 内部文件（React Chunks、资源文件等）。

重新打包时不要直接使用 `jar c0Mf`，否则容易把 `resources.arsc` 压缩错误，导致安装时报 `-2`。

建议流程：
- 使用 `zip`/Python 脚本重新打包，并确保 `resources.arsc` 与图片资源以 `STORED` 方式写入
- 使用 `zipalign` 做 4 字节对齐
- 使用 `apksigner` 进行 V1/V2 签名

## Star History

<a href="https://www.star-history.com/?repos=Tom6814%2FJMComic3-NO-Ads&type=timeline&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Tom6814/JMComic3-NO-Ads&type=timeline&legend=top-left" />
 </picture>
</a>
