---
name: "jmcomic-apk-mod"
description: "JMComic3 APK 逆向修改：输入 APK 文件，自动解包→去广告→移除游戏/电影板块。支持 AI 可执行的意图解析+自定义组合。基于 v2.0.29 实战经验。触发词：JMComic去广告、APK修改、去除游戏电影、jmcomic mod"
---

# JMComic3 APK 逆向修改技能

基于 JMComic3 v2.0.29（React + Webpack 架构）的 APK 逆向修改实战经验。

**使用流程**：
1. 用户提供 APK → 解包
2. **向用户提问，确认需求** → 意图解析 → 输出步骤清单
3. 用户确认后 → 逐步执行修改
4. 验证通过 → 重新打包

> **原则：宁可多留一个文件，不可误删一个模块。** 每步操作前先验证，操作后立即检查。

---

## 架构概览

JMComic3 是一个 React SPA 应用，打包为 Android APK。理解以下三个核心概念即可上手：

### 1. Webpack 分块系统

代码被拆分成多个 `.chunk.js` 文件，按需加载：

| 机制 | 语法 | 作用 |
|------|------|------|
| 加载依赖 | `n.e(CHUNK_ID)` | 异步加载一个 chunk 文件 |
| 绑定模块 | `n.bind(n, MODULE_ID)` | 返回模块的导出内容 |
| 懒加载组件 | `a.lazy(...)` | React.lazy，路由导航时才触发加载 |

### 2. 广告系统

广告通过两层机制运作：

```
Module 8038（广告组件，v2.0.29 ID，跨版本可能变化）
  └── 接收 adKey（如 "app_home_top"）渲染广告位

Module 8284（文字链接，v2.0.29 ID，跨版本可能变化）
  └── 通过 first_links 数据生成页面顶部文字广告
```

### 3. 关键文件

以下按**功能角色**描述，非固定文件名。Chunk ID 在跨版本时保持不变的可能性较高，但 hash 部分每版必变。

| 角色 | 识别方式 | 定位 |
|------|---------|------|
| 主入口 | 文件名 `main.*.js`（不含 chunk） | 路由表、lazy 组件、Redux store、chunk map |
| App Shell | 体积最大的 chunk，含首页/闪屏/确认页逻辑 | 首页渲染、确认页弹窗、闪屏页 |
| 共享模块 1 | 含底部导航栏定义 + `Module 8038`（广告组件） | 导航栏、广告渲染、设置页 |
| 共享模块 2 | 含底部导航栏变体 + `Module 8284`（文字链接） | 导航栏变体、文字链接广告 |
| 搜索页面 | 含 `path:"/search"` 路由引用的 chunk | **绝对不能删！** |
| 漫画详情页 | 含 `app_detail_tab_bottom` 相关广告位的 chunk | 详情页广告 |
| 导航栏变体 3/4 | 与共享模块 2 类似的导航栏重复定义 | 同一份 tab 配置的副本 |

> **自查方法**：用 `grep "n\.bind(n," main.*.js` 列出所有模块绑定，反向追踪每个 chunk ID 的功能归属。不想猜的话，用「侦查七步法」。

---

## 通用前置步骤

### 0. 解包 APK

用户只需提供一个 `.apk` 文件，后续全部自动化。

```bash
# 用户提供的 APK 路径（唯一需要用户指定的变量）
APK_FILE="/path/to/JMComic3_v2.0.29.apk"
WORK_DIR="/path/to/JMComic3v2.0.29"

# 解包（APK 本质是 ZIP 文件）
mkdir -p "$WORK_DIR"
unzip -o "$APK_FILE" -d "$WORK_DIR"
cd "$WORK_DIR"
```

> APK 内部结构速览：`classes.dex`（Java/Kotlin 字节码）、`resources.arsc`（编译后的资源表）、`assets/`（Web 前端文件，**我们主要修改这个目录**）、`res/`（Android 原生资源）、`META-INF/`（签名信息）、`AndroidManifest.xml`（清单文件）。

### 1. 需求确认（必须执行，不可跳过）

**不要假设用户想要什么。** 解包完成后，根据用户的初始表述和以下维度，主动向用户提问确认：

**询问维度**：

| 维度 | 示例问题 |
|------|---------|
| 广告范围 | "要去掉所有广告，还是只去掉特定类型的（闪屏/banner/文字链接）？" |
| 板块去留 | "游戏和电影板块要保留、删除其中一部分、还是全部删除？" |
| 修改方式 | "是否需要 Git 版本管理？还是直接改文件就行？" |
| 打包方式 | "修改完需要重新打包成 APK 吗？推荐使用 GitHub Actions 在线打包，无需安装 Android SDK（约 1GB），零本地环境依赖。" |
| 打包类型 | "需要哪种 APK？Debug（调试版，~25MB，可直接安装）/ Release（发布版，~25MB，需签名）/ 两种都要？" |

**问法示例**（用户说"帮我去广告"时）：

```
了解。在开始之前确认几个细节：

1. 广告范围 — 所有广告都去？还是保留某些（如闪屏）？
2. 板块去留 — 游戏和电影板块要不要一起删掉？
3. 版本管理 — 需要 Git 追踪修改记录，还是直接改文件就行？
4. 打包方式 — 推荐 GitHub Actions 在线打包（无需装 Android SDK），还是本地打包？
5. 打包类型 — Debug（可直接安装）/ Release（需签名）/ 都要？
```

根据用户回答，运行「[意图解析流程](#意图解析流程)」生成步骤清单，展示给用户确认后再动手。

### 2. 工作准备

```bash
# 解包后进入工作目录
cd "$WORK_DIR"
```

**方式一：Git 版本管理（推荐—可回滚）**

```bash
git init && git add -A && git commit -m "原始版本"
```

**方式二：直接修改（无 Git—适合一次性操作）**

无需额外操作。建议自行备份原始文件：
```bash
cp -r assets/public/static/js assets/public/static/js.bak
```

> Git 方式适合多步修改和回滚；无 Git 方式适合"只改一两处就行"的场景。由用户决定。

### 搜索速查表

| 目标 | 搜索模式 | 示例 |
|------|---------|------|
| 路由 | `path:"/xxx"` | `path:"/search"` |
| 懒加载组件 | `a.lazy(...n.bind(n,ID)` | `n.bind(n,5884)` → 搜索页 |
| 广告位 | `adKey:"xxx"` | `adKey:"app_home_top"` |
| 文字链接数据 | `first_links` | 8 个 chunk 中含此模式 |
| 免广告标志 | `ad_free` | 改为 `!0` |
| Chunk 引用 | `n.e(ID)` | `n.e(5884)` 加载搜索 chunk |
| 模块绑定 | `n.bind(n,ID)` | `n.bind(n,5884)` 绑定搜索模块 |

### 安全守则（9 条）

1. **永远精确字符串替换**，不用正则
2. **修改前搜索确认作用域**，一处还是多处
3. **修改前检查敏感上下文**（Cookie、主题、阅读器 — 见下方）
4. **每小步验证后再继续**（Git 模式：改前 commit 改后 grep；无 Git 模式：改前备份文件）
5. **删 chunk 前双重确认**：`n.e()` 和 `n.bind()` 无残留引用
6. **共享代码全量搜索**，不遗漏任何重复 chunk
7. **不用 `git add -A`**，指定具体文件
8. **.map 分析完再删**，它是唯一的源码线索
9. **不确定的 chunk 保留不删**

---

## 禁止触碰的区域

以下 6 类代码与广告系统完全隔离，**绝对不要修改**：

| # | 区域 | 识别关键词 | 误改后果 |
|---|------|-----------|---------|
| 1 | Cookie/登录态 | `cookie`, `AVS`, `token`, `session` | 登录丢失、进度丢失 |
| 2 | 亮暗色模式 | `theme`, `dark`, `light`, `DarkMode` | 主题切换失效 |
| 3 | 阅读器核心 | `reader`, `viewer`, `scroll`, `zoom` | 翻页/缩放异常 |
| 4 | Redux Store | `darkMode`, `user`, `settings`（`ad_free` 除外） | 全局状态异常 |
| 5 | Android 桥 | `Android`, `WebView`, `bridge`, `JavascriptInterface` | 原生功能失效 |
| 6 | 网络/API | `fetch(`, `axios`, `.php`, `api`, `baseURL` | 数据加载失败 |

**修改前安全检查**：
```bash
# 检查目标代码周围 200 字符是否触碰敏感区域
grep -oP '.{0,200}要删除的字符串.{0,200}' target.js \
  | grep -iE 'cookie|token|theme|dark|reader|bridge|android|fetch'
# 有输出 → 暂停审查 / 无输出 → 安全继续
```

> **黄金法则**：看不懂的 minified 代码不要动。宁可多问，不可乱改。

---

## 自定义需求指南（AI 执行手册）

本章为 AI 提供一套机械化的意图解析流程——接收用户的自然语言需求，输出一个无歧义的步骤清单。

### 意图解析流程

```
用户输入（自然语言）
  → 1. 关键词提取：匹配下方的「意图→步骤」决策表
  → 2. 步骤收集：合并所有匹配到的步骤 ID
  → 3. 冲突检测：检查是否有互斥操作（如"删电影"+"保留电影"）
  → 4. 排序去重：按执行顺序排列（A1→A10 → B1→B6）
  → 5. 输出清单：向用户确认后再执行
```

### 意图 → 步骤决策表

解析用户请求时，按以下规则逐条匹配。每条命中就收集对应的步骤 ID。**多命中合并，不互斥**。

| 用户意图关键词 | 匹配逻辑 | 收集步骤 |
|---------------|---------|---------|
| `去广告` / `移除广告` / `无广告` / `去所有广告` | 全广告清除 | A1, A2, A3, A4, A5, A6, A7, A8, A9 |
| `banner` / `顶部广告` / `首页广告` | 仅首页广告位 | A2 |
| `闪屏` / `启动广告` / `开屏` | 仅闪屏 | A4 |
| `插屏` / `路由广告` / `跳转广告` | 仅路由插屏 | A3 |
| `浮动` / `悬浮` / `底部广告` | 仅浮动广告 | A3 |
| `文字链接` / `文字广告` / `顶部链接` | 仅文字链接 | A7 |
| `详情页广告` / `漫画页广告` | 仅详情页 | A5 |
| `搜索页广告` / `搜索底部` | 仅搜索页 | A6 |
| `弹窗` / `确认页` / `popup` | 仅弹窗 | A8 |
| `保留闪屏` / `不要删闪屏` / `闪屏留着` | 排除闪屏 | 从已收集步骤中移除 A4 |
| `保留banner` / `不要删banner` | 排除 banner | 从已收集步骤中移除 A2 |
| `去游戏` / `移除游戏` / `删游戏` / `不要游戏` | 删游戏板块 | B1_games, B2_games, B3, B4, B5 |
| `去电影` / `移除电影` / `删电影` / `不要电影` | 删电影板块 | B1_movies, B2_movies, B3, B4, B5 |
| `去板块` / `移除板块` / `去游戏和电影` / `全删` | 删全部板块 | B1, B2, B3, B4, B5 |
| `保留游戏` / `不要删游戏` | 排除游戏 | 从已收集步骤中移除所有 B_games |
| `保留电影` / `不要删电影` | 排除电影 | 从已收集步骤中移除所有 B_movies |
| `只侦查` / `研究结构` / `分析` / `不修改` | 仅侦查 | 侦查七步法（不执行任何修改步骤） |
| `不改chunk` / `不删文件` / `只屏蔽渲染` / `保守` | 保守模式 | 收集广告步骤，但跳过 B3/B4/B5（不删 chunk） |

### 步骤排程规则

收集到步骤集合后，按以下顺序排列执行：

```
优先级: A1 > A2 > A3 > A4 > A5 > A6 > A7 > A8 > A9 > B1 > B2 > B3 > B4 > B5 > 删.map
```

**互斥处理**：
- 如果同时命中「去某板块」和「保留该板块」→ 保留优先，不执行删除
- 如果用户只说了"去广告"未提板块 → 默认不执行任何 B 步骤
- 如果执行了任何 B 步骤 → B3/B4/B5 必须配套执行（孤儿清理是强制依赖）

**隐式依赖**：
- 执行任何 A 步骤 → 隐含需先执行 A1（ad_free 是全局基础）
- 执行任何 B 步骤 → 隐含需先完成所有 A 步骤（去广告是去板块的前提）
- 执行 B3 → 必须在 B1+B2 之后
- 执行 B5 → 必须在 B4 之后

### adKey → 步骤映射

每个广告位对应一个修改步骤：

| 广告位 | 位置 | 步骤 | 页面 |
|--------|------|------|------|
| `app_home_top` | 首页顶部 banner | A2 | 首页 |
| `app_home_float` | 首页浮动 | A3 | 首页 |
| `app_route` | 路由插屏 | A3 | 全局跳转 |
| `app_splash` | 闪屏1 | A4 | 启动 |
| `app_splash2` | 闪屏2 | A4 | 启动 |
| `app_splash_bottom` | 闪屏底部 | A4 | 启动 |
| `app_detail_tab_bottom_jm3` | 详情页底部 | A5 | 漫画详情 |
| `app_detail_introduction_bottom_jm3` | 详情简介底部 | A5 | 漫画详情 |
| `app_search_bottom_jm3` | 搜索页底部 | A6 | 搜索 |
| `app_movies_top_banner` | 电影页顶部 | A2（相同模式） | 电影（有板块时） |
| `app_movies_fixed_bottom_jm3` | 电影页底部 | A3（相同模式） | 电影（有板块时） |
| `app_categories_bottom_jm3` | 分类页底部 | A3（相同模式） | 分类（有板块时） |
| 页面顶部文字链接 | 全局 | A7 | 所有页面 |

### 功能移除 → 步骤映射

| 目标 | 步骤 | 说明 |
|------|------|------|
| 移除游戏 | B1_games + B2_games + B3 + B4 + B5 | 仅删 `/games` 路由及孤儿 chunk |
| 移除电影 | B1_movies + B2_movies + B3 + B4 + B5 | 仅删 `/movies`、`/movies/:id` 路由及孤儿 chunk |
| 全部移除 | B1 + B2 + B3 + B4 + B5 | 游戏+电影全删 |

### 解析示例

```
用户: "帮我去掉banner和文字链接，电影板块也不要了，但游戏留着"
  → 关键词匹配: banner=A2, 文字链接=A7, 去电影=B1_movies+B2_movies+B3+B4+B5, 保留游戏=排除B_games
  → 隐式依赖: A2→需A1, B步骤→需全部A步骤
  → 最终清单: A1, A2, A3, A4, A5, A6, A7, A8, A9, B1_movies, B2_movies, B3, B4, B5
  → 去重排序后执行

用户: "只去掉闪屏广告，其他都不要动"
  → 关键词: 闪屏=A4
  → 隐式依赖: A4→需A1
  → 最终清单: A1, A4

用户: "分析一下这个新版本的广告结构，先不改"
  → 关键词: 分析+不修改
  → 最终清单: 侦查七步法
```

---

## 场景 A：去广告

> **适用场景**：保留游戏/电影板块，清除所有广告。
> **以下所有代码块均为 v2.0.29 示例，用于展示修改模式。新版本中具体的 chunk ID、变量名、替换字符串可能不同——请先执行「侦查七步法」定位，再按相同模式修改。**

### A1. 全局 ad_free 标志

**文件**：`main.*.js` | **难度**：★ | **风险**：低

```python
# v2.0.29 示例
("ad_free:!1", "ad_free:!0", "全局免广告")
```

将 Redux store 中的 `ad_free` 强制为 `true`。广告组件渲染前会检查此标志。

> **自查**：`grep "ad_free" main.*.js`，找到 `ad_free:!1` 或 `ad_free:!0` 附近的精确字符串。

### A2. 首页顶部 Banner

**文件**：含 `app_home_top` 的 chunk | **难度**：★★ | **风险**：低

```python
# v2.0.29 示例 — 新版本需先 grep "app_home_top" 定位实际字符串
("(0,N.jsx)(E.A,{adKey:\"app_home_top\",adIndex:e})", "null", "首页 banner")
("bannerList:null", "bannerList:[]", "banner 数据源")
```

> **自查**：`grep -l "app_home_top" assets/public/static/js/*.js` 定位文件，再 `grep -oP '.{0,80}app_home_top.{0,80}'` 提取精确替换字符串。

### A3. 路由插屏 + 首页浮动

**文件**：含 `app_route` 的 chunk（通常与 A2 同一文件） | **难度**：★ | **风险**：低

```python
# v2.0.29 示例
("(0,N.jsx)(E.A,{adKey:\"app_route\"})", "null", "路由插屏")
("(0,N.jsx)(E.A,{adKey:\"app_home_float\"})", "null", "首页浮动")
```

> **自查**：`grep -oP '.{0,80}app_route.{0,80}'` 和 `grep -oP '.{0,80}app_home_float.{0,80}'` 提取替换字符串。

### A4. 闪屏广告

**文件**：含 `app_splash` 的 chunk | **难度**：★★ | **风险**：中

```python
# v2.0.29 示例
("[\"app_splash\",\"app_splash2\",\"app_splash_bottom\"].map(", "[].map(", "闪屏数据源")
```

> **自查**：`grep -oP '.{0,120}\"app_splash\".{0,120}'` 提取完整的数据源数组，改为空数组。额外搜索启动页渲染逻辑中的广告索引（通常为数字 3），确认跳过。

### A5. 漫画详情页

**文件**：含 `app_detail_tab_bottom` 的 chunk | **难度**：★★ | **风险**：低

```python
# v2.0.29 示例 — 将广告 JSX 渲染替换为 null
("(0,N.jsx)(E.A,{adKey:\"app_detail_tab_bottom_jm3\"})", "null", "详情页底部")
("(0,N.jsx)(E.A,{adKey:\"app_detail_introduction_bottom_jm3\"})", "null", "详情简介底部")
```

> **自查**：`grep -l "app_detail" assets/public/static/js/*.js` 定位文件，再用 `grep -oP '.{0,80}app_detail.{0,80}'` 提取精确替换字符串。

### A6. 搜索页底部

**文件**：含 `app_search_bottom` 的 chunk（即搜索页面 chunk） | **难度**：★ | **风险**：低

```python
# v2.0.29 示例
("adKey:\"app_search_bottom_jm3\"", "adKey:\"\"", "搜索页底部广告")
```

> ⚠️ 此 chunk 是搜索页面的核心。**只改广告渲染，绝不删文件。**

> **自查**：`grep -l "app_search_bottom" assets/public/static/js/*.js` 定位，提取 JSX 替换为 null。

### A7. 顶部文字链接（关键步骤）

**文件**：所有含 `first_links` 的 chunk | **难度**：★★★ | **风险**：低

广告链：`first_links 数据 → exchange_link 组件 → 页面顶部`

**操作**：

```bash
# 1. 找到所有涉及的 chunk
grep -rl "first_links" assets/public/static/js/*.js | grep -v ".map"
```

在每个命中文件中执行：

```python
# v2.0.29 示例 — 新版本需 grep 确认实际字符串格式
("return[...X.first_links||[],...Y]", "return[]", "first_links → 空")
```

额外处理 `exchange_link`（通常在含 `Module 8284` 的 chunk 中）：

```python
# v2.0.29 示例
("exchange_link:...something...", "exchange_link:b([])", "exchange_link 清空")
```

> **自查**：`grep -oP '.{0,60}first_links.{0,60}'` 在每个命中文件中提取精确替换字符串。v2.0.29 涉及 8 个文件，新版本可能不同。

### A8. 确认页弹窗

**文件**：含 `splash_top` 或 `pop1_list` 的 chunk（通常与 A2 同一文件） | **难度**：★★ | **风险**：中

```python
# v2.0.29 示例
("splash_top:...", "splash_top:[]", "弹窗数据源")
```

> **自查**：`grep -oP '.{0,80}pop1_list|splash_top.{0,80}'` 定位弹窗数据源，清空对应数组。

### A9. ad_free 补丁确认

**文件**：含 `Module 8038` 的 chunk（共享模块 1） | **难度**：★ | **风险**：低

确认广告组件中的 ad_free 检查逻辑已生效。v2.0.29 中对应 `L=!0`——新版本中变量名会变，需搜索 `ad_free` 在 chunk 文件中的出现位置确认。

> **自查**：`grep "ad_free" assets/public/static/js/*.chunk.js`，确认广告组件中该标志被强制为 true。

### A10. 验证

```
[ ] 首页无 banner / 浮动广告
[ ] 各页面无顶部文字链接
[ ] 漫画详情页无广告
[ ] 搜索页无底部广告
[ ] 无闪屏（启动直达主页）
[ ] 路由跳转无插屏
[ ] 游戏/电影板块正常
[ ] grep -r "adKey" 返回条目均已处理
[ ] 核心功能：暗色模式 ✓ 登录态 ✓ 阅读器 ✓ 搜索 ✓ 下载 ✓
```

---

## 场景 B：去广告 + 去板块

> **前提**：场景 A 所有步骤已完成并验证通过。
> **以下所有代码块和 chunk ID 均为 v2.0.29 示例。新版本中 chunk ID、路由格式、lazy 组件变量名均可能变化——请先用「侦查七步法」定位，再按相同模式修改。**

### B1. 移除路由

**文件**：`main.*.js` | **难度**：★★ | **风险**：中

```js
// v2.0.29 示例 — 新版本用 grep 'path:"/games"\|path:"/movies"' main.*.js 提取
(0,Se.jsx)(e.qh,{path:"/games",element:...}),
(0,Se.jsx)(e.qh,{path:"/movies",element:...}),
(0,Se.jsx)(e.qh,{path:"/movies/:id",element:...}),
```

> **自查**：`grep -oP '.{0,100}path:"/(games|movies)[^"]*".{0,100}' main.*.js` 提取精确的路由定义行，逐个删除。如果用户只要删游戏或只要删电影，只删对应路由。

### B2. 移除 Tab 入口

**文件**：5 个 chunk | **难度**：★★★ | **风险**：低

```bash
# 找到所有含 tab 定义的 chunk
grep -rl '"games"\|"movies"' assets/public/static/js/*.js | grep -v ".map"
```

在每个命中的 chunk 中删除如下条目：

```js
// v2.0.29 示例 — 新版本 grep -oP '.{0,80}"games".{0,80}' 提取
{icon:...,nav:"games",label:x("nav.game"),link:"/games"},    // 删除
{icon:...,nav:"movies",label:x("nav.movie"),link:"/movies"},   // 删除
```

> **自查**：先 `grep -rl '"games"\|"movies"'` 找到所有文件，再逐个 `grep -oP '.{0,80}"games".{0,80}'` 提取精确行删除。文件数量每版不同，v2.0.29 涉及 5 个。

### B3. 识别孤儿组件

路由删除后，对应的 lazy 组件不再被使用。用脚本自动识别：

```bash
MAIN_JS=$(ls assets/public/static/js/main.*.js | head -1)
python3 -c "
import re
with open('$MAIN_JS') as f: content = f.read()
lazy = {m.group(1): m.group(3) for m in re.finditer(r'(\w+)=a\.lazy\(\(\)=>Promise\.all\(\[([^\]]*)\]\)\.then\(n\.bind\(n,(\d+)\)\)\)', content)}
route_comps = set(re.findall(r'element:\(0,\w+\.jsx\)\((\w+)', content))
for name, cid in lazy.items():
    if name not in route_comps:
        print(f'  孤儿 → {name} (chunk {cid})')
"
```

v2.0.29 孤儿示例（仅供理解输出格式）：`ze`(7521 电影列表)、`De`(6120 电影播放器)、`Fe`(8063 游戏页/依赖 2846)。

> **自查**：脚本自动运行，无需手动猜测。

### B4. 清理 main.js

**文件**：`main.*.js` | **难度**：★★ | **风险**：中

1. 删除上一步识别的每个孤儿 lazy 定义行
2. 删除 chunk map 中对应条目（如 `,2846:"861c1e38"`）

### B5. 删除孤儿 chunk

**删除前确认**（不可省略）：

```bash
# CHUNK_IDS 替换为 B3 脚本输出的 chunk ID 列表
CHUNK_IDS="2846 6120 7521"  # v2.0.29 示例
for ID in $CHUNK_IDS; do
  echo "=== chunk $ID ==="
  grep -r "n\.e($ID)" assets/public/static/js/ | grep -v ".map"  # 必须空
  grep -r "n\.bind(n,$ID)" assets/public/static/js/ | grep -v ".map"  # 必须空
done
```

确认两项均为空后，删除对应的 `.js` 和 `.map` 文件。

> **自查**：Chunk ID 列表来自 B3 脚本输出，不手动硬编码。

### B6. 验证

```
[ ] 场景 A 全部通过（含核心功能）
[ ] 底部导航无"游戏""电影"
[ ] 搜索正常（无白屏）
[ ] 无残留 n.e() 引用
[ ] 所有页面路由跳转正常
[ ] 暗色模式 / 登录态 / 阅读进度 正常
```

---

## 内容注入（扩展思路）

用户可能想在去广告的同时往 APK 里**加入**自己的内容，常见场景如：

- 把广告位替换为自己的推广图片
- 替换启动图/图标
- 注入自定义 CSS 或 JS 脚本

### 通用思路

由于面对的是 minified Webpack 产物，无法直接"加一段代码"，但可利用已有入口：

**图片类替换**（最稳妥）：
- 广告位被替换为 `null` 后，该区域在 DOM 中消失。若用户想在此位置放自己的图片，不需要改 JS——在 `index.html` 中注入一个固定定位的 `<img>` 标签即可。
- 资源文件直接放入 `assets/` 目录，重新打包时自动包含。

**启动图/图标替换**：
- `res/mipmap-*` 和 `res/drawable-*` 文件夹包含启动图和图标，替换同名文件即可。
- 已在 v2.0.29 实战中验证。

**JS/CSS 注入**（需谨慎）：
- 安全方式：在 `assets/public/index.html` 中追加 `<script>` 或 `<style>` 标签。
- chunk 内注入：不推荐（作用域风险）。

### 询问与确认

当用户提出"想加点东西"时，按以下顺序确认：

1. **加什么** — 图片、CSS、JS 脚本？
2. **加在哪里** — 哪个页面、什么位置？
3. **触发条件** — 始终显示还是特定条件？

然后坦诚告知：
- 能做到的 → 给出方案
- 需要侦查才能确认的 → 先侦查再答复
- 当前架构下不支持的 → 直接说明，不画饼

> 本节为开放思路，具体实现取决于用户需求和实际代码结构。**基本原则：能做就做，不能做就说，不强行编造方案。**

---

## 新版本适配流程

> JMComic3 是上游闭源项目。新版本中文件名 hash 和变量名可能变化，但核心架构（Webpack + React Router + 广告机制）不变。

### 侦查七步法

接手新版本 APK 时，**不要急于修改**，按顺序侦查：

#### 1. 保留 .map，用它了解项目

```bash
python3 -c "
import json, glob
for f in glob.glob('assets/public/static/js/main.*.js.map'):
    with open(f) as fp:
        data = json.load(fp)
    for s in data.get('sources', []): print(s)
" 2>/dev/null | head -30
```

#### 2. 提取路由表 + 组件→chunk 映射

```bash
MAIN_JS=$(ls assets/public/static/js/main.*.js | head -1)
python3 -c "
import re
with open('$MAIN_JS') as f: content = f.read()
for m in re.finditer(r'path:\\\"([^\\\"]+)\\\"', content):
    ctx = content[m.start():m.start()+200]
    elem = re.search(r'element:\(0,\w+\.jsx\)\((\w+)', ctx)
    print(f'/{m.group(1):30s} → {elem.group(1) if elem else \"?\"}')
"
```

#### 3. 扫描 adKey

```bash
grep -roh 'adKey:"[^"]*"' assets/public/static/js/*.js | sort -u
```

对照上文 adKey 映射表，确认哪些是新增的。

#### 4. 定位 first_links 分布

```bash
grep -rl "first_links" assets/public/static/js/*.js
```

#### 5. 定位 Tab 栏

```bash
grep -rl '"games"\|"movies"' assets/public/static/js/*.js
```

#### 6. 建立 chunk 引用关系

```bash
for id in $(grep -oh 'n\.e(\d\+)' "$MAIN_JS" | grep -o '\d\+' | sort -u); do
  refs=$(grep -l "n\.e($id)\|n\.bind(n,$id)" assets/public/static/js/*.js | wc -l)
  echo "chunk $id: $refs 处引用"
done
```

#### 7. 全部完成后删 .map

```bash
find assets/public -name "*.map" -type f -delete
```

### 跨版本自查原则

文档中 `# v2.0.29 示例` 的代码块在跨版本时**可能与实际代码不同，也可能完全相同**——取决于上游是否改动了广告相关逻辑。不要预设一定会变或一定不变。

遇到 Python `batch_replace` 返回 `FAIL` 时，按以下优先级自行探索：

**P0 — 先扫描 adKey（最稳定的特征）**：
```bash
grep -roh 'adKey:"[^"]*"' assets/public/static/js/*.js | sort -u
```
对照已知 adKey 映射表，快速判断哪些广告位还在、哪些新增、哪些消失。

**P1 — 字符串不匹配 → 扩大搜索窗口**：
```bash
# 截取关键词周围上下文，观察新版本的渲染格式
grep -oP '.{0,150}app_home_top.{0,150}' target_chunk.js
# 从上下文中提取新的精确替换字符串，更新替换元组
```

**P2 — 文件定位失败 → 特征搜索代替 ID 搜索**：
- 不找 `6809.*.chunk.js` → 找含 `app_home_top` 的 chunk
- 不找 `1791.*.chunk.js` → 找含 `ad_free` 和 JSX 渲染的 chunk
- 不找 `7451.*.chunk.js` → 找含 `app_detail` 的 chunk

**P3 — 变量名变化 → 追踪语义等价**：
- `L=!0` 可能变成 `M=!0` 或 `adFree=!0`
- `E.A`（JSX 工厂）可能变成 `s.jsx` 或 `r.createElement`
- 关键：**不找变量名，找功能语义**——广告组件始终接收 `adKey` 参数

**P4 — 新增未知广告位 → 自行推断，而非直接问用户**：
```bash
grep -roh 'adKey:"[^"]*"' assets/public/static/js/*.js | sort -u | while read key; do
  echo "$key → $(grep -l "$key" assets/public/static/js/*.js)"
done
```
不在已知映射表中的 adKey：
1. 观察其渲染格式——是否与已知广告位（如 `app_home_top`）共用同一组件
2. 在 `.map` 文件中搜索该 adKey 上下文，确认所属页面
3. 参考最相似的已知广告位处理方式（JSX 替换为 null / 数据源清空）
4. 自行决定处理方式并执行——大多数情况下新模式只是旧模式的变体

**P5 — 以上路径均走不通 → 换思路，不放弃**：
- 检查是否因为 chunk hash 变化导致在错误文件中搜索 → 扩大 `grep -rl` 范围到整个 `js/` 目录
- 检查是否上游重构了广告架构（如从 Webpack Module 改为动态导入）→ 对比 `.map` 的 sources 列表
- 检查是否广告位被改名（如 `app_home_top` → `app_main_top`）→ 搜索 `adKey` 附近的上下文语义
- 已成功定位的步骤可以先执行，失败的步骤留到下一轮单独攻克

**P6 — 所有路径穷尽后**：
"以下广告位在当前版本中与其他已知模式差异较大，暂时未能定位：xxx。请问是否需要：1) 我继续深入分析 2) 跳过这些，先执行已定位的步骤 3) 您手动定位后告诉我具体位置"

> 核心原则：**先自行探索，多路径尝试。绝大多数跨版本差异只是变量名和 hash 的变化，结构不变。实在穷尽手段后再告知用户，而非一遇 FAIL 就求助。**

---

## 实战避坑

以下来自 v2.0.29 真实踩坑记录：

| # | 现象 | 根因 | 教训 |
|---|------|------|------|
| 1 | 搜索白屏 | 误删 5884（它其实是搜索页，不是电影） | 删 chunk 前必须查 `n.bind()` 确认用途 |
| 2 | Tab 仍在 | Tab 栏在 5 个 chunk 中重复定义 | 共享 UI 全量 `grep -rl` 搜索 |
| 3 | 文字链接复现 | first_links 在 8 个 chunk，只补了 2 个 | 不凭感觉，`grep -rl` 找全 |
| 4 | APK 变大 | `git add -A` 提交了 79MB 构建产物 | 只用 `git add <file>` |
| 5 | 分析困难 | .map 删太早，后续无法回溯 | .map 留到验证通过 |

### 广告追踪的核心思路

```
用户看到的广告位置
  → 搜索 minified JS 中的渲染代码
  → 找到 adKey（如 "app_home_top"）
  → 追踪渲染函数 → Module 8038
  → 处理策略：
      直接渲染 → JSX 替换为 null
      列表生成 → 清空数据源
      全局控制 → ad_free 强制 true
  → 顽固广告（文字链接）：
      追踪 Module 8284 → first_links → 全量搜索 → 逐个修补
```

---

## APK 体积优化

### 删除 .map 文件

> **只在所有修改验证通过后执行。**

```bash
find assets/public -name "*.map" -type f -delete
git ls-files --deleted | grep "\.map$" | xargs git rm
echo "*.map" >> .gitignore
```

体积对比（v2.0.29）：28.9 MB → 25.1 MB（-3.8 MB）

---

## 构建与部署

修改完成后，将修改后的文件重新打包为 APK。

### 打包方式选择

**推荐：GitHub Actions 在线打包** — 无需安装 Android SDK（约 1GB+），零本地环境依赖，适用于所有用户。

**本地打包** — 需安装 JDK 17+ 和 Android SDK Build-Tools，适用于开发者。

> 在需求确认阶段就应告知用户这个选项。大多数用户选择 GitHub Actions 即可。

### APK 类型说明

| 类型 | 大小 | 签名 | 用途 |
|------|------|------|------|
| **Debug APK** | ~25MB | 自动 debug 签名 | 直接安装测试，无需配置签名。适合自己用 |
| **Release APK** | ~25MB | 需提供 keystore | 正式发布用。未签名或自签名的 release APK 也可直接安装 |
| **两者都要** | ~50MB 总计 | - | 同时产出 debug 和 release 版本 |

> Debug 和 Release 体积几乎相同，区别仅在于签名方式。大部分用户选 Debug 即可。

### 方式一：GitHub Actions 在线打包（推荐）

将修改推送到 GitHub 仓库后，Actions 自动构建。用户只需从 Artifacts 下载 APK。

```yaml
# .github/workflows/build-apk.yml
name: Build APK
on:
  push:
    branches: [main, master]
  workflow_dispatch:
    inputs:
      build_type:
        description: 'APK 类型'
        required: true
        type: choice
        options: [debug, release, both]
        default: debug

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: {java-version: '17', distribution: 'temurin'}
      - uses: android-actions/setup-android@v3

      - name: Package APK (Debug)
        if: ${{ github.event.inputs.build_type == 'debug' || github.event.inputs.build_type == 'both' }}
        run: |
          rm -f META-INF/CERT.RSA META-INF/CERT.SF META-INF/MANIFEST.MF
          zip -D -0 app-debug-unsigned.apk resources.arsc classes.dex DebugProbesKt.bin AndroidManifest.xml
          zip -r -D -n ".png:.jpg:.jpeg:.gif:.webp:.mp3:.mp4:.ogg:.dex" \
            app-debug-unsigned.apk assets/ kotlin/ META-INF/ org/ res/ \
            -x "*.DS_Store" "__MACOSX/*" ".git/*" ".github/*" ".gitignore" "*.apk" "*.keystore" "skills/*"
          keytool -genkey -keystore debug.keystore -alias androiddebugkey \
            -keyalg RSA -keysize 2048 -validity 10000 \
            -storepass android -keypass android \
            -dname "CN=Debug, OU=Dev, O=JM" -noprompt
          $ANDROID_SDK_ROOT/build-tools/34.0.0/zipalign -v -p 4 app-debug-unsigned.apk app-debug.apk
          $ANDROID_SDK_ROOT/build-tools/34.0.0/apksigner sign \
            --ks debug.keystore --ks-pass pass:android \
            --out JMComic3-debug.apk app-debug.apk

      - name: Package APK (Release)
        if: ${{ github.event.inputs.build_type == 'release' || github.event.inputs.build_type == 'both' }}
        run: |
          rm -f META-INF/CERT.RSA META-INF/CERT.SF META-INF/MANIFEST.MF
          zip -D -0 app-release-unsigned.apk resources.arsc classes.dex DebugProbesKt.bin AndroidManifest.xml
          zip -r -D -n ".png:.jpg:.jpeg:.gif:.webp:.mp3:.mp4:.ogg:.dex" \
            app-release-unsigned.apk assets/ kotlin/ META-INF/ org/ res/ \
            -x "*.DS_Store" "__MACOSX/*" ".git/*" ".github/*" ".gitignore" "*.apk" "*.keystore" "skills/*"
          $ANDROID_SDK_ROOT/build-tools/34.0.0/zipalign -v -p 4 app-release-unsigned.apk app-release-aligned.apk
          $ANDROID_SDK_ROOT/build-tools/34.0.0/apksigner sign \
            --ks release.keystore --ks-pass pass:${{ secrets.KEYSTORE_PASS }} \
            --out JMComic3-release.apk app-release-aligned.apk

      - uses: actions/upload-artifact@v4
        if: ${{ github.event.inputs.build_type == 'debug' || github.event.inputs.build_type == 'both' }}
        with: {name: JMComic3-debug, path: JMComic3-debug.apk}
      - uses: actions/upload-artifact@v4
        if: ${{ github.event.inputs.build_type == 'release' || github.event.inputs.build_type == 'both' }}
        with: {name: JMComic3-release, path: JMComic3-release.apk}
```

**首次使用 GitHub Actions 打包前的操作**：
1. 将项目推送到 GitHub 仓库
2. 将上述 YAML 写入 `.github/workflows/build-apk.yml`
3. 在仓库 Settings → Secrets 中添加 `KEYSTORE_PASS`（仅 release 需要）
4. 进入 Actions 页面，手动触发 `Build APK` workflow，选择 `build_type`
5. 等待 2-3 分钟，从 Artifacts 下载 APK

### 方式二：本地打包

需要本地安装 JDK 17+ 和 Android SDK Build-Tools。适用于开发者或网络受限场景。

```bash
# Debug APK（自动签名，可直接安装）
cd "$WORK_DIR"
rm -f META-INF/CERT.RSA META-INF/CERT.SF META-INF/MANIFEST.MF
zip -D -0 app-unsigned.apk resources.arsc classes.dex DebugProbesKt.bin AndroidManifest.xml
zip -r -D -n ".png:.jpg:.jpeg:.gif:.webp:.mp3:.mp4:.ogg:.dex" \
  app-unsigned.apk assets/ kotlin/ META-INF/ org/ res/ \
  -x "*.DS_Store" "__MACOSX/*" ".git/*" ".github/*" ".gitignore" "*.apk" "*.keystore" "skills/*"
keytool -genkey -keystore debug.keystore -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Debug" -noprompt
zipalign -v -p 4 app-unsigned.apk app-aligned.apk
apksigner sign --ks debug.keystore --ks-pass pass:android \
  --out JMComic3-mod.apk app-aligned.apk
```

```bash
# Release APK（需提供 keystore 和密码）
# ...同上，签名时替换 keystore 路径和密码
apksigner sign --ks your-release.keystore --ks-pass pass:YOUR_PASS \
  --out JMComic3-release.apk app-aligned.apk
```

> 本地打包需 ~1GB Android SDK + ~500MB JDK，磁盘空间不足时选择 GitHub Actions。

---

## 故障排查

| 症状 | 最常见原因 | 修复 |
|------|-----------|------|
| **搜索白屏** | chunk 5884 被误删 | 恢复 5884 chunk 文件 |
| **文字链接复现** | first_links 有遗漏 | `grep -rl "first_links"` 全量修补 |
| **Tab 仍在** | 只改了部分 chunk | `grep -rl '"games"'` 逐个处理 |
| **APK 变大** | .bak/build-artifact 误提交 | 检查 git 大文件，清理后重建 |
| **新版匹配失败** | 变量名变了 | 搜索 `adKey` / `E.A` 重新定位 |

---

## Python 辅助脚本

```python
"""JMComic3 APK 批量精确字符串替换"""
import sys

def batch_replace(file_path, replacements):
    """replacements: [(old_str, new_str, description), ...]"""
    with open(file_path, 'r') as f:
        content = f.read()

    ok = fail = 0
    for old, new, desc in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"  OK  {desc}")
            ok += 1
        else:
            print(f"  FAIL {desc} — 未找到!")
            fail += 1

    if fail == 0:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"完成: {ok}/{len(replacements)}")
    else:
        print(f"中断: {fail} 处失败，文件未修改")
        sys.exit(1)
```

---

## 版本适配速查

| 稳定要素 | 说明 |
|----------|------|
| `n.e(ID)` / `n.bind(n, ID)` | Webpack 加载机制 |
| `a.lazy(...)` | React.lazy 模式 |
| `adKey:"xxx"` | 广告位标识 |
| `first_links` / `exchange_link` | 文字链接数据键 |
| `ad_free` | 免广告标志 |
| `path:"/xxx"` | 路由路径 |
| Chunk ID（数字） | 跨版本相对稳定 |

**适配核心：不找文件名，找特征模式。先用 .map 侦查，再按模式定位，验证通过后删 .map。**
