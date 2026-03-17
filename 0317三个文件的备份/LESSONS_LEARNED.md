# Xboard Jumping 主题仪表盘模块注入 — 踩坑全记录

## 项目目标
在 Xboard 用户仪表盘（`/user#/dashboard`）注入自定义内容模块（统计卡片、客户端下载、订阅地址、公告、流量图），显示在"我的订阅"等原始内容之上，与原始内容一体滚动。

---

## 文件结构（最终确认）

| 文件 | 位置 | 说明 |
|------|------|------|
| `dashboard.blade.php` | `/opt/Xboard/theme/Xboard/dashboard.blade.php` | 页面模板，**挂载只读**，必须在宿主机修改 |
| `theme-dashboard-modules.js` | `/opt/Xboard/public/theme/Xboard/` 或容器内 `/www/public/theme/Xboard/` | 注入逻辑主文件，可读写 |
| `jumping.css` / `theme-sync.js` | 同上 | 主题样式和暗色切换 |

**重要**：`/www/theme`（容器内）挂载自 `/opt/Xboard/theme`（宿主机），是**只读**的。
`/www/public/theme` 是可写的，`theme-dashboard-modules.js` 放在这里。

---

## 坑 1：dashboard.blade.php 有两个版本

### 错误
以为 `/www/public/theme/Xboard/dashboard.blade.php` 是渲染页面用的模板。

### 真相
Laravel 实际渲染的是 `/www/theme/Xboard/dashboard.blade.php`（对应宿主机 `/opt/Xboard/theme/Xboard/dashboard.blade.php`）。

`/www/public/theme/Xboard/` 里的文件是**静态资源**，不是模板。

### 教训
改模板必须改 `/opt/Xboard/theme/Xboard/dashboard.blade.php`。

---

## 坑 2：页面被一个旧的"全页覆盖"方案污染

### 错误
以为注入逻辑全在 `theme-dashboard-modules.js`，一直改这个文件却没有效果。

### 真相
`/opt/Xboard/theme/Xboard/dashboard.blade.php` 里有一个 785 行的旧方案：
- 用 `position: fixed; left: 200px; top: 60px` 把 `#jumping-dashboard` 硬编码叠加在 Vue app 上
- 用 CSS 把 `#app` 往下推 500px 腾空间
- 这个方案完全独立于 `theme-dashboard-modules.js`，导致"覆盖整个页面"

### 解决
把 `dashboard.blade.php` 恢复为标准模板，只保留加载 Vue + 主题 JS 的逻辑。旧方案全部删除。

---

## 坑 3：浏览器强缓存导致改了没效果

### 错误
多次修改 `theme-dashboard-modules.js` 后刷新，浏览器仍加载旧文件（控制台版本号不变）。

### 原因
- nginx 对 `.js` 文件设置了 30 天缓存
- 版本号来自 `UpdateService::getCurrentVersion()`，基于 git commit hash，不会自动变

### 解决方案
在 `dashboard.blade.php` 的 script 标签上加 `&t=YYYYMMDD` 后缀：
```html
<script src="/theme/{{$theme}}/theme-dashboard-modules.js?v={{$version}}&t=20260317"></script>
```
**每次更新 JS 文件后，把这里的日期改一下**，浏览器就会强制拉新文件。

### 不要做
- 不要改 `config/app.php` 里的 `version`（不是版本号来源）
- 不要用 `php artisan cache:clear` 期望改变版本号（Redis 缓存的是 git hash，清了也会重新生成同样的值）
- 不要重启容器期望版本号变（同上）

---

## 坑 4：findTarget() 的 DOM 定位逻辑越来越复杂

### 错误
写了三级降级策略（NaiveUI sider → article.flex → #app 往下钻），越改越复杂，各种条件判断，最终还是找错。

### 真实 DOM 结构（控制台实测）
```
article.flex
  ├── [0] HEADER.flex.items-center.bg-white  (顶部导航栏, 60px)
  └── [1] SECTION.flex-1.overflow-hidden      (主区域)
            └── SECTION.cus-scroll-y.wh-full.flex-col  ← overflow:auto, padding:16px
                      └── DIV.mb-1.md:mb-10            ← 原始内容容器（我的订阅/捷径等）
                            ├── [原始内容...]
                            └── DIV.n-back-top-placeholder
```

### 注入目标
`DIV.mb-1`（`.cus-scroll-y` 的第一个有高度的子节点），把 `#JDM` 插到它的 `firstChild` 之前。

### 正确的 findTarget
```javascript
function findTarget() {
  var scrollEl = document.querySelector('article.flex .cus-scroll-y');
  if (!scrollEl) return null;
  for (var i = 0; i < scrollEl.children.length; i++) {
    if (scrollEl.children[i].offsetHeight > 0) return scrollEl.children[i];
  }
  return scrollEl;
}
```

### 不要做
- 不要用 `.n-layout-sider`（这个主题没有 NaiveUI sider）
- 不要用 `.n-scrollbar-content`（不存在）
- 不要直接返回 `.cus-scroll-y` 作为注入目标（它是 `wh-full` 固定高度容器，插入大量内容会撑出去）

---

## 坑 5：注入时机问题

### 错误
用 `setInterval` 轮询 `findTarget()`，找到目标后立即注入。但轮询时 `.cus-scroll-y` 已出现，而其子节点 `DIV.mb-1` 还没有内容，导致注入到空容器或提前触发。

### 解决
用 `MutationObserver` 监听 `document.body`，等 `target.children.length > 0`（即 Vue 渲染出原始内容后）再注入，然后立即断开 observer。

```javascript
function tryInjectNow() {
  var target = findTarget();
  if (target && target.children.length > 0) {
    if (_obs) { _obs.disconnect(); _obs = null; }
    injectModules(target);
    loadData();
  }
}
```

---

## 坑 6：getToken() 拦截注入

### 错误
`injectModules` 里有 `if (!getToken()) return`，导致在 token 还没就绪时拒绝注入，后续也不会重试注入 DOM 结构（只会重试数据请求）。

### 解决
把注入（DOM 操作）和数据请求分开：
- `injectModules`：只负责插入 `#JDM` DOM，不检查 token
- `loadData`：负责 API 请求，如果没有 token 则轮询等待

---

## 最终架构

```
dashboard.blade.php
  ├── 加载 Vue (umi.js)
  ├── 加载 jumping.css
  ├── 加载 theme-sync.js（暗色主题切换）
  └── 加载 theme-dashboard-modules.js（我们的注入脚本）

theme-dashboard-modules.js
  ├── onRouteChange()：监听 hashchange/popstate
  ├── MutationObserver：等 .cus-scroll-y > DIV.mb-1 渲染完毕
  ├── injectModules()：把 #JDM 插到 DIV.mb-1 的 firstChild 之前
  └── loadData()：并行请求 5 个 API，渲染统计/客户端/订阅/公告/流量图
```

---

## 坑 7：路由切走再切回，注入内容消失

### 错误
`tryInjectNow` 注入成功后立即 `_obs.disconnect()`，停掉了 MutationObserver。
Vue 路由切走时，`#JDM` 和 `.cus-scroll-y` 都被销毁。切回来时 observer 已停，无法重新注入。

### 解决
注入成功后**不要 disconnect**，保持 observer 持续运行。
`tryInjectNow` 里已有 `if (document.getElementById(INJECT_ID)) return` 防止重复注入。
只在路由离开 dashboard 时才 disconnect。

```javascript
function tryInjectNow() {
  if (!isDashboard()) { removeModules(); return; }
  if (document.getElementById(INJECT_ID)) return; // 防重复
  var target = findTarget();
  if (target && target.children.length > 0) {
    // 注入成功，但不 disconnect observer！
    injectModules(target);
    loadData();
  }
}

function onRouteChange() {
  removeModules();
  if (isDashboard()) {
    tryInjectNow();
    startDomObserver(); // 持续监听
  } else {
    if (_domObs) { _domObs.disconnect(); _domObs = null; } // 离开才停
  }
}
```

---

## 坑 8：明暗切换后模块颜色不变

### 错误
`theme-sync.js` 用 body 背景色亮度来判断主题，但 Xboard 切换时背景色变化有延迟，导致误判。
`jumping.css` 亮色选择器只有 `html.light`，但 Xboard 切换亮色时根本不加 `light` class。

### Xboard 实际的明暗切换信号（控制台实测）

| 状态 | `html.class` | `vueuse-color-scheme` |
|------|-------------|----------------------|
| 暗色 | `dark` | `dark` |
| 亮色 | `（空）` | `auto` |

**结论：Xboard 亮色 = 移除 `dark` class，不加任何其他 class。**

### 解决

**`jumping.css`** 加上 `html:not(.dark)` 选择器：
```css
html.light,
html:not(.dark),          /* ← 新增，命中 Xboard 亮色状态 */
html[data-theme="light"],
html:has([data-theme="light"]) {
  --jp-card: #ffffff;
  /* ... */
}
```

**`theme-sync.js`** 极简化，只看 `dark` class：
```javascript
function isDark() {
  return document.documentElement.classList.contains('dark');
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark() ? 'dark' : 'light');
}
new MutationObserver(applyTheme).observe(
  document.documentElement,
  { attributes: true, attributeFilter: ['class'] }
);
applyTheme();
```

### 不要做
- 不要用 body 背景色亮度判断主题（渲染延迟会误判）
- 不要监听 `localStorage` 变化（Xboard 不通过 localStorage 切换主题）
- 不要用 `vueuse-color-scheme` 值判断（`auto` 不代表亮色）

---

## 坑 9：浏览器缓存导致改了没效果（版本号系统）

### 版本号来源
页面里 `?v={{$version}}` 来自 `UpdateService::getCurrentVersion()`，基于 git commit hash + 日期，**不会因为改文件内容而变化**。

### 解决方案
在 `dashboard.blade.php` 的 3 个资源标签上加固定后缀 `&t=YYYYMMDD`：
```html
<link rel="stylesheet" href="/theme/{{$theme}}/jumping.css?v={{$version}}&t=20260317c">
<script src="/theme/{{$theme}}/theme-sync.js?v={{$version}}&t=20260317c"></script>
<script src="/theme/{{$theme}}/theme-dashboard-modules.js?v={{$version}}&t=20260317c"></script>
```
**每次更新这 3 个文件中的任何一个，把 `&t=` 后面的日期改一下（加字母区分当天多次更新）。**

### 不要做
- 不要改 `config/app.php` 里的 version（不是版本号来源）
- 不要用 `php artisan cache:clear` 期望改变版本号
- 不要重启容器期望版本号改变（缓存在 Redis，key 是 `CURRENT_VERSION`）
- 如果必须强制改版本号：`Cache::forget('CURRENT_VERSION'); Cache::forever('CURRENT_VERSION', 'newhash');`

---

## 坑 10：NaiveUI 卡片边框无法用普通 CSS 覆盖

### 问题
想去掉"我的订阅"等卡片边框，写了 `.n-card--bordered { border: none !important; }` 没有任何效果。

### 原因（三层叠加）
1. **NaiveUI 动态注入** `<style>` 标签，规则是 `.n-card.n-card--bordered { border: 1px solid var(--n-border-color); }`，两个类选择器，优先级 0,2,0，高于单类 `.n-card--bordered`（0,1,0）
2. **`jumping.css` 自己也加了边框**：`.n-card, [class*="n-card"]:not(...)` 用属性选择器给所有卡片加 `border: 1px solid var(--jp-border) !important`，这条优先级极高
3. **CSS 变量写在内联 style 里**：`--n-border-color` 直接写在元素 `style=""` 属性，外部 CSS 无法覆盖变量值

### 诊断方法
```javascript
// 找出所有匹配元素的 CSS 规则和来源
var el = document.querySelector('.n-card--bordered.mt-1');
for (var s of document.styleSheets) {
  try {
    for (var r of s.cssRules) {
      if (r.selectorText && el.matches(r.selectorText) && r.style.border) {
        console.log(r.selectorText, '=>', r.style.border, '[', s.href || 'inline', ']');
      }
    }
  } catch(e) {}
}
```

### 解决
最简单有效：直接把 `jumping.css` 里给所有卡片加边框的那条规则改为 `border: none !important`：
```css
.n-card,
[class*="n-card"]:not(.n-menu-item):not(.n-menu-item-content) {
  border: none !important;  /* 从 1px solid var(--jp-border) 改为 none */
}
```
这样同时覆盖了 jumping.css 自己的规则和 NaiveUI 的规则（因为 `!important` + 选择器优先级更高）。

### 不要做
- 不要只加 `.n-card--bordered { border: none !important; }`（单类选择器优先级不够）
- 不要试图覆盖 `--n-border-color` 变量（它在内联 style 里，外部 CSS 无效）
- 不要用 `article .cus-scroll-y .n-card.n-card--bordered { border: none !important; }`（jumping.css 自己的规则优先级更高，仍然胜出）

---

## 坑 11：Nginx 不能直接读 xboard-web-1 容器里的文件

### 错误
以为 Laravel/Octane 对静态文件有自己的缓存，所以改 Nginx 配置让它直接从磁盘读 `/www/public`，绕过 Laravel：
```nginx
location ~* ^/theme/.*\.(js|css)$ {
    root /www/public;  # 错误！
}
```

### 后果
所有 `/theme/` 路径返回 404，网站主题文件全部加载失败，整个主题崩坏。

### 原因
`/www/public` 在 `xboard-web-1` 容器里，`xboard-nginx` 容器根本看不到这个路径，两个容器文件系统完全隔离。

### 正确架构
```
浏览器 → xboard-nginx → proxy_pass → xboard-web-1（Laravel/Octane）→ /www/public/
```
Nginx 只负责转发和控制 HTTP 缓存头，**不持有文件**。Laravel 才是真正服务静态文件的一层。

### 正确配置
```nginx
location ~* ^/theme/.*\.(js|css)$ {
    set $backend "web:7001";
    proxy_pass http://$backend;
    proxy_set_header Host $host;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires 0;
}
```
`no-cache` 头是告诉**浏览器**不要缓存，文件本身还是通过 proxy_pass 从 Laravel 正确获取。

### Laravel 有文件缓存吗？
**没有**。Laravel/Octane 对静态文件是直接读磁盘，没有文件级缓存。之前以为有缓存是误判，真正的问题一直是**浏览器缓存**，用 `&t=` 时间戳参数解决即可。

---

## 文件真实位置（最终确认）

| 文件 | 宿主机路径 | 容器路径 | 说明 |
|------|-----------|---------|------|
| `dashboard.blade.php` | `/opt/Xboard/theme/Xboard/` | `/www/theme/Xboard/` | 挂载同步，宿主机改容器自动更新 |
| `jumping.css` | `/opt/Xboard/theme/Xboard/` | `/www/public/theme/Xboard/` | **不同步**，改完需手动 docker cp |
| `theme-dashboard-modules.js` | `/opt/Xboard/theme/Xboard/` | `/www/public/theme/Xboard/` | **不同步**，改完需手动 docker cp |
| `theme-sync.js` | `/opt/Xboard/theme/Xboard/` | `/www/public/theme/Xboard/` | **不同步**，改完需手动 docker cp |
| `nginx.conf` | `/opt/Xboard/nginx.conf` | `/etc/nginx/conf.d/default.conf` | 挂载同步，改完需 `docker exec xboard-nginx nginx -s reload` |

**关键**：`/www/theme` 挂载自 `/opt/Xboard/theme`（同步），但 `/www/public/theme` **不挂载**，是容器内独立目录，必须手动 `docker cp`。

---

## 每次更新主题文件的完整步骤

### 更新 jumping.css / theme-dashboard-modules.js / theme-sync.js
1. 修改 `/opt/Xboard/theme/Xboard/` 下对应文件
2. `docker cp /opt/Xboard/theme/Xboard/jumping.css xboard-web-1:/www/public/theme/Xboard/jumping.css`
3. `docker cp /opt/Xboard/theme/Xboard/theme-dashboard-modules.js xboard-web-1:/www/public/theme/Xboard/theme-dashboard-modules.js`
4. 修改 `dashboard.blade.php` 里的 `&t=` 后缀（改成今天日期，当天多次改则加字母 a/b/c）
5. `docker exec xboard-web-1 php artisan view:clear`
6. 浏览器强制刷新（Ctrl+Shift+R）验证

### 更新 nginx.conf
1. 修改 `/opt/Xboard/nginx.conf`（挂载自动同步到容器）
2. `docker exec xboard-nginx nginx -t`（验证语法）
3. `docker exec xboard-nginx nginx -s reload`（重载，如果失败用 `docker restart xboard-nginx`）

### 不要做
- 不要 `docker cp` 把整个 nginx.conf 覆盖到 `/etc/nginx/nginx.conf`（那是 Nginx 主配置，会破坏 include 结构）
- `/etc/nginx/conf.d/default.conf` 才是我们的配置文件挂载点
