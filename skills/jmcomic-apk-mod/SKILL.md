---
name: "jmcomic-apk-mod"
description: "JMComic3 APK 逆向修改：去除广告、移除游戏/电影板块。支持仅去广告和去广告+去板块两种模式。基于 v2.0.29 实战经验编写。触发词：JMComic去广告、APK修改、去除游戏电影、jmcomic mod"
---

# JMComic3 APK 逆向修改技能

基于 JMComic3 v2.0.29 (React + Webpack 架构) 的 APK 逆向修改实战经验。支持两种模式：
- **分支 A：仅去广告** — 移除所有广告但保留游戏/电影板块
- **分支 B：去广告 + 去游戏/电影** — 彻底移除广告和游戏/电影功能

> **原则：宁可多留一个文件，不可误删一个模块。** 每步操作前先验证，操作后立即检查。

---

## 项目架构概览

JMComic3 是一个 React SPA 应用，打包为 Android APK。关键特征：

- **Webpack 分块系统**：`n.e(CHUNK_ID)` 加载依赖 chunk，`n.bind(n, MODULE_ID)` 绑定主模块
- **React.lazy() 代码分割**：每个路由对应一个 lazy 组件，仅导航到时才加载对应 chunk
- **广告系统**：Module 8038 渲染 adKey 广告位，Module 8284 渲染文字链接广告
- **Minified JS**：所有代码为单行 minified，精确字符串匹配 + Python 脚本是唯一可靠修改方式

### 关键文件

| 文件 | 说明 |
|------|------|
| `assets/public/static/js/main.1876db95.js` | 主入口：路由、lazy 组件、Redux store、chunk map |
| `assets/public/static/js/6809.9d9dbb0a.chunk.js` | App Shell：首页、确认页、闪屏页 |
| `assets/public/static/js/1791.bd2e4958.chunk.js` | 共享：底部导航栏、广告组件(Module 8038)、设置页 |
| `assets/public/static/js/3224.aa28c3ae.chunk.js` | 底部导航栏变体 |
| `assets/public/static/js/3742.085eee1f.chunk.js` | 底部导航栏变体 |
| `assets/public/static/js/7999.6e5ea2d5.chunk.js` | 底部导航栏变体 + exchange_link(Module 8284) |
| `assets/public/static/js/5884.86bb3aa6.chunk.js` | 搜索页面（此文件绝对不能删！） |
| `assets/public/static/js/7451.3a8e8413.chunk.js` | 漫画详情页 |

### Chunk 文件命名规则

```
格式：{chunk_id}.{content_hash}.chunk.js
示例：6809.9d9dbb0a.chunk.js  → chunk ID = 6809, hash = 9d9dbb0a
```

chunk ID 是数字，跨版本相对稳定；hash 每次构建可能变化。

---

## 通用前置步骤

### 工作准备

```bash
# 1. 解压 APK → 工作目录
WORK_DIR="/path/to/JMComic3v2.0.29"
cd "$WORK_DIR"

# 2. Git 初始化，保留原始状态
git init && git add -A && git commit -m "原始版本"

# 3. 创建分支
git checkout -b mod-no-ads        # 分支A：仅去广告
# 或
git checkout -b mod-no-games-movies  # 分支B：去广告+去板块
```

### 关键识别模式

在 minified JS 中查找目标代码的模式：

| 要找的内容 | 搜索模式 | 示例 |
|-----------|---------|------|
| 路由定义 | `path:"/xxx"` | `path:"/search"` |
| 懒加载组件 | `a.lazy(...n.bind(n,ID)` | `a.lazy(()=>Promise.all([...]).then(n.bind(n,5884)))` |
| 广告渲染 | `adKey:"xxx"` | `adKey:"app_home_top"` |
| 文字链接 | `first_links` | `return[...X.first_links\|\|[],...Y]` |
| 免广告标志 | `ad_free` | `ad_free:!1` → 改为 `ad_free:!0` |
| Chunk 引用 | `n.e(ID)` | `n.e(5884)` 表示加载 chunk 5884 |
| 模块绑定 | `n.bind(n,ID)` | `n.bind(n,5884)` 表示绑定模块 5884 |

### 操作安全守则

以下守则来自多次踩坑的教训：

1. **永远用精确字符串替换**。minified 代码中一个字符差之毫厘，结果谬以千里
2. **修改前先搜索，确认只有一处匹配**。如果同一模式出现在多个位置，逐个理解再决定
3. **修改前 git commit，修改后立即 grep 验证**。每个小改动一个 commit，出错时只需 revert 一步
4. **删除 chunk 文件前，必须确认**：
   - `grep -r "n.e(CHUNK_ID)" assets/` 只在 main.js 中出现
   - `grep -r "n.bind(n,CHUNK_ID)" assets/` 只在 main.js 中出现
   - 对应的 lazy 组件未被任何路由使用
5. **修改共享代码时，必须全量搜索**。同样的 tab 栏/广告逻辑可能在多个 chunk 中重复
6. **不要用 `git add -A`**。始终指定具体文件，防止误提交 build-artifact、.bak 等无关文件
7. **.map 文件在分析完成前不删**。它们是理解 minified 代码结构的唯一线索
8. **任何模棱两可的 chunk，选择保留而不是删除**

---

## 上游依赖与版本适配策略

### 核心认知

JMComic3 是**上游闭源项目**。我们做的是逆向修改，而非源码级定制。上游发布新版本时：

- 文件名 hash **可能**变化（`main.1876db95.js` → `main.XXXXXXXX.js`）
- 变量名**可能**重新混淆（`Se.jsx` → `Xe.jsx`）
- 广告位、模块结构**可能**调整
- **但核心架构通常不变**：Webpack 分块、React Router、广告机制

### 适配新版本的标准侦查流程

接手新版本 APK 时，**不要急于修改**。按以下顺序完成"侦查—理解—定位—修改—验证"：

#### 第一步：保留 .map 文件，用它来理解项目

.map 文件是新版本侦查最有力的工具。先不要删除。用它了解：哪些 chunk 对应什么功能、广告代码分布在哪里。

```bash
# 快速了解项目：列出 main.js.map 中的源文件
python3 -c "
import json, glob
for f in glob.glob('assets/public/static/js/main.*.js.map'):
    with open(f) as fp:
        data = json.load(fp)
    for s in data.get('sources', []):
        print(s)
" 2>/dev/null | head -30
```

#### 第二步：提取路由表 + 组件映射

```bash
MAIN_JS=$(ls assets/public/static/js/main.*.js | head -1)

# 提取所有路由
python3 -c "
import re
with open('$MAIN_JS') as f: content = f.read()
for m in re.finditer(r'path:\"([^\"]+)\"', content):
    # 同时提取附近的 element 组件名
    ctx = content[m.start():m.start()+200]
    elem = re.search(r'element:\(0,\w+\.jsx\)\((\w+)', ctx)
    print(f'/{m.group(1):30s} → {elem.group(1) if elem else \"?\"}')" 
"

# 提取所有 lazy 组件 → chunk ID
python3 -c "
import re
with open('$MAIN_JS') as f: content = f.read()
for m in re.finditer(r'(\w+)=a\.lazy\(\(\)=>Promise\.all\(\[([^\]]*)\]\)\.then\(n\.bind\(n,(\d+)\)\)\)', content):
    deps = re.findall(r'n\.e\((\d+)\)', m.group(2))
    print(f'{m.group(1):10s} → chunk {m.group(3):5s}  (deps: {deps})')
"
```

#### 第三步：扫描所有 adKey，建立广告位清单

```bash
# 列出所有广告位 key
grep -roh 'adKey:"[^"]*"' assets/public/static/js/*.js | sort -u

# 预期输出（v2.0.29）：
# adKey:"app_home_top"              - 首页顶部 banner
# adKey:"app_route"                 - 路由插屏
# adKey:"app_home_float"            - 首页浮动
# adKey:"app_splash" / app_splash2  - 闪屏
# adKey:"app_search_bottom_jm3"     - 搜索页底部
# adKey:"app_detail_tab_bottom_jm3" - 详情页
# adKey:"app_movies_top_banner"     - 电影页顶部
# adKey:"app_movies_fixed_bottom_jm3"- 电影页底部
# adKey:"app_categories_bottom_jm3" - 分类页底部
```

#### 第四步：定位 Module 8284 文字链接分布

```bash
# first_links 是顶部文字链接广告的数据源
# 必须找到所有包含它的 chunk
grep -rl "first_links" assets/public/static/js/*.js
```

#### 第五步：定位 Tab 栏分布

```bash
# Tab 栏可能在多个 chunk 中重复定义
grep -rl '"games"\|"movies"' assets/public/static/js/*.js
```

#### 第六步：建立完整的 chunk 引用关系图

```bash
# 对每个 chunk ID，检查被哪些文件引用
for id in $(grep -oh 'n\.e(\d\+)' "$MAIN_JS" | grep -o '\d\+' | sort -u); do
  refs=$(grep -l "n\.e($id)\|n\.bind(n,$id)" assets/public/static/js/*.js | wc -l)
  echo "chunk $id: $refs 处引用"
done
```

#### 第七步：确认所有修改完成、验证通过后，删除 .map

```bash
find assets/public -name "*.map" -type f -delete
```

---

## 分支 A：仅去广告

适用于：保留游戏/电影功能，仅清除所有广告。

### A1. 设置 Redux ad_free 标志

**文件**：`assets/public/static/js/main.*.js`

**操作**：搜索 `ad_free`，将值从 `!1`（false）改为 `!0`（true）。

```
旧：ad_free:!1  （或 ad_free:!1）
新：ad_free:!0
```

**原理**：ad_free 是 Redux store 中的全局免广告标志。设为 true 后，广告组件在渲染前会检查此标志并跳过。

**验证**：`grep 'ad_free' assets/public/static/js/main.*.js`

### A2. 首页顶部 Banner 广告

**文件**：`assets/public/static/js/6809.*.chunk.js`

**A2.1 广告渲染 → null**：

搜索包含 `adKey:"app_home_top"` 的完整 JSX 表达式，将整个渲染替换为 `null`：

```
旧：(0,N.jsx)(E.A,{adKey:"app_home_top",adIndex:e})
新：null
```

**A2.2 数据源清空**：

```
旧：bannerList:null
新：bannerList:[]
```

### A3. 路由插屏 + 首页浮动广告

**文件**：`assets/public/static/js/6809.*.chunk.js`

```
旧：(0,N.jsx)(E.A,{adKey:"app_route"})
新：null

旧：(0,N.jsx)(E.A,{adKey:"app_home_float"})
新：null
```

### A4. 闪屏广告

**文件**：`assets/public/static/js/6809.*.chunk.js`

**A4.1 闪屏数据源清空**：

```
旧：["app_splash","app_splash2","app_splash_bottom"].map(...
新：[].map(...
```

**A4.2 跳过广告页**：搜索 `2===M` 附近的页面跳转逻辑，确保广告页（通常索引 3）被跳过。

### A5. 漫画详情页广告

**文件**：`assets/public/static/js/7451.*.chunk.js`

搜索以下 adKey，将对应的 JSX 渲染替换为 `null`：
- `app_detail_tab_bottom_jm3`
- `app_detail_introduction_bottom_jm3`

### A6. 搜索页底部广告

**文件**：`assets/public/static/js/5884.*.chunk.js`

搜索 `app_search_bottom_jm3`，将对应渲染替换为 `null`。

> **此文件是搜索页面的核心 chunk，只修改广告渲染部分，绝不能删除整个文件！**

### A7. 顶部文字链接广告（最容易被遗漏）

**广告链**：`first_links 数据 → exchange_link 组件 → 页面顶部文字链接`

**关键发现**：Module 8284 (exchange_link_top / first_links) 的逻辑被 webpack 内联到了多个 chunk 中。只改一个是不够的。

**操作步骤**：

1. 先找到所有包含 `first_links` 的 chunk：

```bash
grep -rl "first_links" assets/public/static/js/*.js | grep -v ".map"
```

2. 在每个文件中找到以下模式并替换：

```
旧：return[...X.first_links||[],...Y]
新：return[]
```

3. 在 `7999.*.chunk.js` 中额外清空 exchange_link 数据：

```
旧：exchange_link:...something...
新：exchange_link:b([])
```

**v2.0.29 中涉及文件**（新版本可能不同）：
3319, 6209, 2030, 1371, 6125, 9517, 383, 7999

**验证**：`grep -r "first_links" assets/public/static/js/*.js | grep -v "return\[\]" | grep -v ".map"` 应返回空。

### A8. 确认页广告清除

**文件**：`assets/public/static/js/6809.*.chunk.js`

清除 G 组件（确认页）中的 `splash_top`、`pop1_list` 等弹窗广告数据源。

### A9. 1791 chunk 补充

**文件**：`assets/public/static/js/1791.*.chunk.js`

1791 包含广告组件(Module 8038)的定义和设置页。确认其中的 `L=!0`（ad_free 补丁）已设置。

### A10. 分支 A 验证 Checklist

```
[ ] 首页无顶部 banner 广告
[ ] 首页无底部浮动广告
[ ] 各页面无顶部文字链接广告
[ ] 漫画详情页无广告
[ ] 搜索页无底部广告
[ ] 无闪屏广告（启动直接进入主页）
[ ] 路由跳转无插屏广告
[ ] 游戏/电影板块正常可用
[ ] grep -r "adKey" 返回的条目均已处理或确认为无害
```

---

## 分支 B：去广告 + 去游戏/电影

**前提**：分支 A 的所有步骤必须已完成并通过验证。

### B1. 移除路由定义

**文件**：`assets/public/static/js/main.*.js`

删除游戏和电影相关路由：

```js
// 要删除的条目（精确匹配）
(0,Se.jsx)(e.qh,{path:"/games",element:(0,Se.jsx)(...)}),
(0,Se.jsx)(e.qh,{path:"/movies",element:(0,Se.jsx)(...)}),
(0,Se.jsx)(e.qh,{path:"/movies/:id",element:(0,Se.jsx)(...)}),
```

> 不同版本的变量名可能不同。关键是匹配 `path:"/games"` 和 `path:"/movies"`。

### B2. 移除底部导航栏 Tab 入口（5 个文件）

**关键教训**：Tab 栏定义在 5 个不同的 chunk 中重复存在，只改一个是没用的。

**操作步骤**：

```bash
# 先找到所有包含 tab 定义的 chunk
grep -rl '"games"\|"movies"' assets/public/static/js/*.js | grep -v ".map"
```

在**每个命中的文件**中删除包含 `"games"` 和 `"movies"` 的 tab 条目：

```js
// 游戏入口 — 删除
{icon:...,nav:"games",label:x("nav.game"),link:"/games"}

// 电影入口 — 删除
{icon:...,nav:"movies",label:x("nav.movie"),link:"/movies"}
```

**v2.0.29 涉及文件**：6809, 1791, 3224, 3742, 7999

**验证**：`grep -r '"games"\|"movies"' assets/public/static/js/*.js | grep -v ".map"` 只能返回 i18n 翻译或搜索页面中的文本匹配，不能有 tab 定义。

### B3. 识别并清理孤儿 lazy 组件

路由删除后，对应的 lazy 组件变成孤儿（dead code）。**先识别，后清理**。

**识别方法**：

```bash
# 对比"所有 lazy 组件"和"路由使用的组件"
# 差集 = 孤儿组件
MAIN_JS=$(ls assets/public/static/js/main.*.js | head -1)
python3 -c "
import re
with open('$MAIN_JS') as f: content = f.read()

# 所有 lazy 组件
lazy = {m.group(1): m.group(3) for m in re.finditer(r'(\w+)=a\.lazy\(\(\)=>Promise\.all\(\[([^\]]*)\]\)\.then\(n\.bind\(n,(\d+)\)\)\)', content)}

# 路由使用的组件
route_comps = set(re.findall(r'element:\(0,\w+\.jsx\)\((\w+)', content))

# 孤儿 = lazy - route
orphans = {k: v for k, v in lazy.items() if k not in route_comps}
print('孤儿组件:')
for name, chunk_id in orphans.items():
    print(f'  {name} → chunk {chunk_id}')
"
```

**v2.0.29 孤儿组件**：
- `ze` → chunk 7521（电影列表）
- `De` → chunk 6120（电影播放器）
- `Fe` → chunk 8063（游戏页，依赖 chunk 2846）

### B4. 删除孤儿 lazy 定义 + chunk map 条目

**文件**：`assets/public/static/js/main.*.js`

删除孤儿 lazy 定义和 chunk map 中对应条目。

**操作**：精确匹配并删除每个孤儿组件的定义行，以及 chunk map 中的 hash 条目。

### B5. 删除孤儿 chunk 文件

**删除前必须确认**（这一步不能省）：

```bash
# 对每个待删 chunk，确认无任何残留引用
for ID in 2846 6120 7521; do
  echo "检查 chunk $ID:"
  grep -r "n\.e($ID)" assets/public/static/js/ | grep -v ".map"
  grep -r "n\.bind(n,$ID)" assets/public/static/js/ | grep -v ".map"
  echo "---"
done
# 两个 grep 都必须返回空！
```

确认后删除 `.js` 和 `.map` 文件。

**v2.0.29 删除文件**：
```
assets/public/static/js/2846.861c1e38.chunk.js + .map
assets/public/static/js/6120.a60bf06c.chunk.js + .map
assets/public/static/js/7521.37bedf44.chunk.js + .map
```

### B6. 分支 B 验证 Checklist

```
[ ] 分支 A 所有检查项通过
[ ] 底部导航栏无"游戏"和"电影"入口
[ ] 点击搜索正常（无白屏）
[ ] 所有页面的顶部文字链接均已清除
[ ] 无残留 n.e() 引用
```

---

## 实战经验与避坑指南

以下来自 v2.0.29 修改过程中的真实踩坑，每条都值得注意。

### 坑1：误删搜索 chunk 导致白屏

**现象**：分支 B 完成后，点击搜索进入白屏，其他页面正常。

**原因**：chunk 5884 被误认为"电影相关 chunk"而删除。实际上 5884 是搜索页面的核心模块（`n.bind(n,5884)`），电影搜索只是其中一个 tab。

**教训**：删除任何 chunk 前，必须用 `grep -r "n.bind(n,CHUNK_ID)"` 确认它绑定的模块用途。不要凭 chunk 名称或表面特征判断。

### 坑2：Tab 入口改了 6809 但没改其他 4 个 chunk

**现象**：修改了 6809 chunk 中的 tab 栏，底部导航的游戏/电影入口仍然显示。

**原因**：Tab 栏定义在 5 个 chunk 中重复存在（6809、1791、3224、3742、7999），这是 webpack 代码分割 + React 组件复用导致的正常现象。

**教训**：修改共享 UI 组件时，必须 `grep -r "关键字"` 全量搜索，确保逐个处理。

### 坑3：文字链接广告只改了 2 个 chunk，遗漏 6 个

**现象**：清除文字链接广告后，部分页面顶部仍然有。

**原因**：Module 8284 (first_links) 被 webpack 内联到了 8 个不同的 chunk。最初只发现了 2 个，修改后广告在另外 6 个页面上仍然出现。

**教训**：用 `grep -rl "first_links" assets/public/static/js/*.js` 全局扫描，不要依赖"我找到了几个"的思维。

### 坑4：`git add -A` 导致 APK 体积不降反升

**现象**：修改后 APK 从 28.9MB 变成了 29.1MB。

**原因**：`git add -A` 把 `build-artifact/`（79MB 构建产物）、`res/*.bak`（图标备份）、根目录的大 PNG 都提交了。`res/` 下的 `.bak` 在打包时被 zip 进了 APK。

**教训**：只用 `git add <specific_file>`，不用 `git add -A`。检查 `.gitignore` 是否覆盖了临时文件。

### 坑5：先删了 .map 导致后续分析困难

**现象**：删完 .map 后发现还有广告，但已经无法通过 .map 反向追踪源码。

**原因**：.map 能直接告诉你 `chunk 7999 → src/components/ExchangeLink.tsx`，没了它只能在 minified 代码里猜。

**教训**：.map 在整个修改验证通过之前都不要删。它是你的"源码地图"。

### 广告系统的"顺藤摸瓜"方法论

整个去广告过程本质是一个"追踪链路"：

```
起点：用户看到的广告位置（页面顶部、底部、闪屏）
  ↓
搜索 minified JS 中该位置的渲染代码
  ↓
找到 adKey 标识（如 "app_home_top"）
  ↓
追踪 adKey 的渲染函数 → Module 8038（广告组件）
  ↓
追踪 Module 8038 的数据源
  - 直接渲染型：找到 JSX → 替换为 null
  - 列表生成型：找到数据生成函数 → 清空数据源
  - 全局控制型：找到 ad_free 标志 → 强制为 true
  ↓
对于"顽固"广告（如文字链接）：追踪 Module 8284
  → 发现它被内联到了多个 chunk
  → 全量搜索 first_links → 逐个修补
```

### 速度与安全的平衡

minified JS 文件非常大（main.js 750KB+），全文读取是必要的开销。以下策略可以平衡效率和安全：

- **并行搜索多个模式**：`grep -rl "adKey\|first_links\|ad_free"` 一次性获取全局视图
- **Python 脚本批量替换**：对确定要改的 pattern，用脚本一次性处理，减少手动操作出错
- **替换后立即 grep 确认**：`grep "旧字符串" 目标文件` 应返回空
- **Git 增量提交**：每完成一类修改（如"文字链接全部清除"）就 commit，方便定位问题

---

## 通用优化：APK 体积

### 最后一步：删除 .map 文件

> **只在所有修改完成、验证通过后执行。在此之前保留 .map 用于侦查。**

```bash
# 查看占用
find assets/public -name "*.map" -type f -exec du -ch {} + | tail -1

# 删除
find assets/public -name "*.map" -type f -delete

# 从 git 移除
git ls-files --deleted | grep "\.map$" | xargs git rm
echo "*.map" >> .gitignore
```

**体积对比（v2.0.29）**：
- 原始：28.9 MB / 645 files
- 去广告+去板块+删.map：25.1 MB / 585 files（**-3.8 MB**）

---

## 构建与部署

### GitHub Actions 构建

```yaml
# .github/workflows/build-release-apk.yml
name: Build Release APK
on:
  push:
    branches: [main, master, no-games-no-movies]
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
          zip -D -0 app-unsigned.apk resources.arsc
          zip -D -0 app-unsigned.apk classes.dex
          zip -D app-unsigned.apk AndroidManifest.xml DebugProbesKt.bin
          zip -r -D -n ".png:.jpg:.jpeg:.gif:.webp:.mp3:.mp4:.ogg:.dex" \
            app-unsigned.apk assets/ kotlin/ META-INF/ org/ res/ \
            -x "*.DS_Store" "__MACOSX/*" ".git/*" ".github/*" ".gitignore" "*.apk" "*.keystore"
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
        with:
          name: JMComic3-Mod
          path: app-release.apk
```

### 下载构建产物

```bash
# 获取最近一次构建
RUN=$(curl -s -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/runs?branch=<BRANCH>&per_page=1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow_runs'][0]['id'])")

# 下载
ARTIFACT=$(curl -s -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/runs/$RUN/artifacts" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['artifacts'][0]['id'])")

curl -sL -H "Authorization: token <TOKEN>" \
  "https://api.github.com/repos/<OWNER>/<REPO>/actions/artifacts/$ARTIFACT/zip" \
  -o apk.zip
unzip apk.zip -d output/
```

---

## 故障排查

### 搜索白屏（紧急）

**症状**：其他导航正常，点击搜索进入白屏
**原因**：搜索页面 chunk（v2.0.29 中为 5884）被误删
**确认**：`grep "n.bind(n,5884)" main.*.js` → 有结果说明搜索依赖此 chunk
**修复**：从原始 APK 或 git 历史恢复被删的 chunk 文件

### 顶部文字链接广告复现

**症状**：之前已清除，但在某些页面仍然出现
**原因**：first_links 模块存在于多个 chunk，有遗漏未修补
**排查**：`grep -rl "first_links" assets/public/static/js/*.js | grep -v ".map"`
**修复**：对每个命中文件，将 `return[...X.first_links||[],...Y]` 改为 `return[]`

### 底部导航 Tab 仍在

**症状**：修改了某个 chunk 的 tab 栏，但入口仍显示
**原因**：Tab 栏在多个 chunk 中重复定义
**排查**：`grep -r '"games"\|"movies"' assets/public/static/js/*.js | grep -v ".map"`
**修复**：逐个处理所有命中文件中的 tab 条目

### APK 体积反而变大

**症状**：修改后 APK 比预期大
**常见原因**：
1. `git add -A` 误提交了 build-artifact/、.bak 等无关文件（res/ 下 .bak 会被打包进 APK）
2. 替换的图标 PNG 比原版大
3. 忘记删 .map 文件

**检查**：
```bash
# 对比两个 APK 文件列表
diff <(unzip -l old.apk | awk '{print $4}' | sort) \
     <(unzip -l new.apk | awk '{print $4}' | sort)
# 检查 git 中是否有不该存在的大文件
git ls-files | xargs -I{} sh -c 'ls -l "{}" 2>/dev/null' | sort -k5 -rn | head -20
```

### 适配新版本时匹配失败

**症状**：在新版本 APK 中搜不到技能文档记录的字符串
**排查步骤**：
1. **保留 .map 文件**，用它理解新版本的模块结构
2. adKey 名称通常不变，从 `grep -roh 'adKey:"[^"]*"'` 开始
3. 如果 JSX 变量名变了，搜索 `E.A`（广告组件引用）
4. 执行"标准侦查流程"重建路由→组件→chunk 映射表
5. `n.e()` / `n.bind()` 机制跨版本稳定，始终可用

---

## Python 辅助脚本模板

```python
"""JMComic3 APK 批量字符串替换工具"""
import sys

def batch_replace(file_path, replacements):
    """对单个文件执行批量精确字符串替换
    replacements: [(old_str, new_str, description), ...]
    """
    with open(file_path, 'r') as f:
        content = f.read()
    
    ok = fail = 0
    for old, new, desc in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"  OK  {desc}")
            ok += 1
        else:
            print(f"  FAIL {desc} — 字符串未找到!")
            fail += 1
    
    if fail == 0:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"完成: {ok}/{len(replacements)} 处替换已写入")
    else:
        print(f"中断: {fail} 处匹配失败，文件未修改")
        sys.exit(1)

# 使用示例
if __name__ == "__main__":
    batch_replace("assets/public/static/js/main.1876db95.js", [
        ("ad_free:!1", "ad_free:!0", "设置 ad_free=true"),
        ("bannerList:null", "bannerList:[]", "清空 banner 列表"),
    ])
```

---

## 版本适配速查

| 不变要素 | 说明 |
|----------|------|
| `n.e(ID)` / `n.bind(n, ID)` | Webpack chunk 加载，所有版本一致 |
| `a.lazy(...)` | React.lazy 模式，所有版本一致 |
| `adKey:"xxx"` | 广告位标识，名称通常不变 |
| `first_links` / `exchange_link` | 文字链接广告数据键 |
| `ad_free` | 免广告 Redux 标志 |
| `path:"/xxx"` | 路由路径 |
| Chunk ID（数字） | Webpack module ID，版本间相对稳定 |

适配新版本的核心：**不要找文件名，找特征模式。先用 .map 侦查，再按模式定位，最后验证通过才删 .map。**
