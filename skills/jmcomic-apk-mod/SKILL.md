---
name: "jmcomic-apk-mod"
description: "JMComic3 APK 逆向修改：输入 APK 文件，自动解包→去广告→移除游戏/电影板块。支持 AI 可执行的意图解析+自定义组合。基于 v2.0.29 实战经验。触发词：JMComic去广告、APK修改、去除游戏电影、jmcomic mod"
---

# JMComic3 APK 逆向修改技能

基于 JMComic3 v2.0.29（React + Webpack 架构）的 APK 逆向修改实战经验。

**预设模式**：
- **分支 A：仅去广告** — 清除所有广告，保留游戏/电影板块
- **分支 B：去广告 + 去板块** — 彻底清除广告和游戏/电影功能
- **自定义组合** — 灵活选取需要的步骤，任意组合（详见「自定义需求指南」）

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
Module 8038（广告组件）
  └── 接收 adKey（如 "app_home_top"）渲染广告位

Module 8284（文字链接）
  └── 通过 first_links 数据生成页面顶部文字广告
```

### 3. 关键文件

| 文件 | 定位 |
|------|------|
| `main.*.js` | 主入口 — 路由表、lazy 组件、Redux store、chunk map |
| `6809.*.chunk.js` | App Shell — 首页、确认页、闪屏页 |
| `1791.*.chunk.js` | 共享模块 — 底部导航栏、广告组件(Module 8038)、设置页 |
| `5884.*.chunk.js` | **搜索页面（绝对不能删！）** |
| `7451.*.chunk.js` | 漫画详情页 |
| `7999.*.chunk.js` | 共享模块 — 导航栏变体 + 文字链接(Module 8284) |
| `3224.*.chunk.js` | 导航栏变体 |
| `3742.*.chunk.js` | 导航栏变体 |

> Chunk 命名规则：`{ID}.{hash}.chunk.js`。ID 是数字（跨版本稳定），hash 随构建变化。

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

### 1. 工作准备

```bash
# 初始化 Git 保留原始状态
git init && git add -A && git commit -m "原始版本"

# 按需求创建分支
git checkout -b mod-no-ads        # 分支A
git checkout -b mod-no-games      # 分支B
git checkout -b mod-custom        # 自定义
```

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
4. **改前 commit，改后 grep**，每小步一个提交
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

## 分支 A：仅去广告

> 适用场景：保留游戏/电影板块，清除所有广告。
> 每个步骤都可以独立执行。步骤编号 = 建议顺序，不是强制依赖。

### A1. 全局 ad_free 标志

**文件**：`main.*.js` | **难度**：★ | **风险**：低

```python
("ad_free:!1", "ad_free:!0", "全局免广告")
```

将 Redux store 中的 `ad_free` 强制为 `true`。广告组件渲染前会检查此标志。

### A2. 首页顶部 Banner

**文件**：`6809.*.chunk.js` | **难度**：★★ | **风险**：低

```python
# 渲染替换为 null
("(0,N.jsx)(E.A,{adKey:\"app_home_top\",adIndex:e})", "null", "首页 banner")
# 数据源清空
("bannerList:null", "bannerList:[]", "banner 数据源")
```

### A3. 路由插屏 + 首页浮动 + 底部固定

**文件**：`6809.*.chunk.js` | **难度**：★ | **风险**：低

```python
("(0,N.jsx)(E.A,{adKey:\"app_route\"})", "null", "路由插屏")
("(0,N.jsx)(E.A,{adKey:\"app_home_float\"})", "null", "首页浮动")
```

### A4. 闪屏广告

**文件**：`6809.*.chunk.js` | **难度**：★★ | **风险**：中

```python
("[\"app_splash\",\"app_splash2\",\"app_splash_bottom\"].map(", "[].map(", "闪屏数据源")
```

额外搜索 `2===M` 附近逻辑，确保启动页跳过广告索引（通常为 3）。

### A5. 漫画详情页

**文件**：`7451.*.chunk.js` | **难度**：★★ | **风险**：低

搜索 `app_detail_tab_bottom_jm3` 和 `app_detail_introduction_bottom_jm3`，将对应 JSX 渲染替换为 `null`。

### A6. 搜索页底部

**文件**：`5884.*.chunk.js` | **难度**：★ | **风险**：低

搜索 `app_search_bottom_jm3`，替换为 `null`。

> ⚠️ 5884 是搜索页面的核心 chunk。**只改广告渲染，绝不删文件。**

### A7. 顶部文字链接（关键步骤）

**文件**：多个 chunk | **难度**：★★★ | **风险**：低

广告链：`first_links 数据 → exchange_link 组件 → 页面顶部`

**操作**：

```bash
# 1. 找到所有涉及的 chunk
grep -rl "first_links" assets/public/static/js/*.js | grep -v ".map"
```

在每个命中文件中执行：

```python
("return[...X.first_links||[],...Y]", "return[]", "first_links → 空")
```

在 `7999.*.chunk.js` 中额外处理：

```python
("exchange_link:...something...", "exchange_link:b([])", "exchange_link 清空")
```

v2.0.29 涉及 8 个文件：3319、6209、2030、1371、6125、9517、383、7999。

### A8. 确认页弹窗

**文件**：`6809.*.chunk.js` | **难度**：★★ | **风险**：中

在 G 组件（确认页）中搜索 `splash_top`、`pop1_list` 等弹窗数据源，清空对应 map。

### A9. 1791 补丁

**文件**：`1791.*.chunk.js` | **难度**：★ | **风险**：低

确认 `L=!0`（ad_free 补丁）已设置。

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

## 分支 B：去广告 + 去板块

> **前提**：分支 A 所有步骤已完成并验证通过。

### B1. 移除路由

**文件**：`main.*.js` | **难度**：★★ | **风险**：中

精确删除：

```js
// 删除以下三个路由（变量名可能因版本而异）
(0,Se.jsx)(e.qh,{path:"/games",element:...}),
(0,Se.jsx)(e.qh,{path:"/movies",element:...}),
(0,Se.jsx)(e.qh,{path:"/movies/:id",element:...}),
```

> 如果不确定，用 `grep 'path:"/games"\|path:"/movies"' main.*.js` 找到精确字符串后删除。

### B2. 移除 Tab 入口

**文件**：5 个 chunk | **难度**：★★★ | **风险**：低

```bash
# 找到所有含 tab 定义的 chunk
grep -rl '"games"\|"movies"' assets/public/static/js/*.js | grep -v ".map"
```

在每个命中的 chunk 中删除如下条目：

```js
{icon:...,nav:"games",label:x("nav.game"),link:"/games"},    // 删除
{icon:...,nav:"movies",label:x("nav.movie"),link:"/movies"},   // 删除
```

v2.0.29 涉及：6809、1791、3224、3742、7999

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

v2.0.29 孤儿：`ze`(7521 电影列表)、`De`(6120 电影播放器)、`Fe`(8063 游戏页/依赖 2846)

### B4. 清理 main.js

**文件**：`main.*.js` | **难度**：★★ | **风险**：中

1. 删除上一步识别的每个孤儿 lazy 定义行
2. 删除 chunk map 中对应条目（如 `,2846:"861c1e38"`）

### B5. 删除孤儿 chunk

**删除前确认**（不可省略）：

```bash
for ID in 2846 6120 7521; do
  echo "=== chunk $ID ==="
  grep -r "n\.e($ID)" assets/public/static/js/ | grep -v ".map"  # 必须空
  grep -r "n\.bind(n,$ID)" assets/public/static/js/ | grep -v ".map"  # 必须空
done
```

确认后删除 `.js` 和 `.map` 文件。

### B6. 验证

```
[ ] 分支 A 全部通过（含核心功能）
[ ] 底部导航无"游戏""电影"
[ ] 搜索正常（无白屏）
[ ] 无残留 n.e() 引用
[ ] 所有页面路由跳转正常
[ ] 暗色模式 / 登录态 / 阅读进度 正常
```

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

```yaml
# .github/workflows/build-release-apk.yml
name: Build Release APK
on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: {java-version: '17', distribution: 'temurin'}
      - name: Package APK
        run: |
          rm -f META-INF/CERT.RSA META-INF/CERT.SF META-INF/MANIFEST.MF
          zip -D -0 app-unsigned.apk resources.arsc classes.dex
          zip -D app-unsigned.apk AndroidManifest.xml DebugProbesKt.bin
          zip -r -D -n ".png:.jpg:.jpeg:.gif:.webp:.mp3:.mp4:.ogg:.dex" \
            app-unsigned.apk assets/ kotlin/ META-INF/ org/ res/ \
            -x "*.DS_Store" "__MACOSX/*" ".git/*" ".github/*" \
               ".gitignore" "*.apk" "*.keystore" "skills/*"
      - name: Sign APK
        run: |
          keytool -genkey -keystore debug.keystore -alias debug \
            -keyalg RSA -keysize 2048 -validity 10000 \
            -storepass android -keypass android \
            -dname "CN=JM, OU=Dev, O=JM, L=CN" -noprompt
          $ANDROID_SDK/build-tools/34.0.0/zipalign -v -p 4 app-unsigned.apk app-aligned.apk
          $ANDROID_SDK/build-tools/34.0.0/apksigner sign \
            --ks debug.keystore --ks-pass pass:android \
            --out app-release.apk app-aligned.apk
      - uses: actions/upload-artifact@v4
        with: {name: JMComic3-Mod, path: app-release.apk}
```

下载产物：
```bash
RUN=$(curl -s -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/runs?branch=<BRANCH>&per_page=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow_runs'][0]['id'])")

ARTIFACT=$(curl -s -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/runs/$RUN/artifacts" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['artifacts'][0]['id'])")

curl -sL -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/artifacts/$ARTIFACT/zip" -o apk.zip
```

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
