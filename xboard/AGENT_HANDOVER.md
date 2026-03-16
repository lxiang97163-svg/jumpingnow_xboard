# 用户仪表盘实现 - Agent 交接总结

## 一、用户原始需求

在 **https://jumpingnow.com/user#/dashboard** 页面的**主页部分**新增以下模块（参考用户提供的设计图）：

1. **顶部摘要卡片**：会员时长、剩余流量、在线设备、钱包余额
2. **客户端下载教程**：Windows/Android/Mac/iOS 选择 + 客户端列表
3. **订阅地址**：多种协议（Clash、Surge、Quantumult X 等）的复制按钮
4. **最新公告**：公告日期 + 内容
5. **流量统计**：72 小时内节点流量柱状图（或本月流量）

**重要**：用户明确说**不需要新增 URL**，只需要在现有的 `/user#/dashboard` 页面中注入这些模块。

---

## 二、我做了什么（两套方案）

### 方案 A：独立页面 /user-home（用户明确不要）

- 创建了 `user-dashboard/index.html` 独立仪表盘
- 在 nginx 中配置了 `/user-home` 路由
- 落地页「用户中心」曾改为指向 `/user-home`
- **问题**：生产环境 404，因为 `user-dashboard` 目录未挂载到 nginx 容器
- **用户反馈**：不需要新 URL，要改的是 `/user#/dashboard`

### 方案 B：在 /user#/dashboard 内注入模块（正确方向）

- 创建了 `jumping-theme/theme-dashboard-modules.js`
- 该脚本在 pathname=/user 且 hash=#/dashboard 时，向页面注入上述模块
- 通过 nginx 的 `sub_filter` 将脚本注入到所有页面的 `</body>` 前
- 脚本会：检测路由 → 等待 SPA 渲染 → 找到内容区域 → 插入 HTML 模块 → 调用 API 拉数据并渲染

---

## 三、当前文件状态

### 新增/修改的文件

| 文件 | 说明 |
|------|------|
| `jumping-theme/theme-dashboard-modules.js` | **核心**：在 /user#/dashboard 注入模块的脚本 |
| `user-dashboard/index.html` | 方案 A 的独立页面（用户不要，可删除） |
| `nginx.conf` | 注入了 theme-dashboard-modules.js；已移除 /user-home 相关配置 |
| `landing/index.html` | 「用户中心」链接已改回 `/user` |
| `compose.yaml` | 仍有 `user-dashboard` 的 nginx volume 挂载（方案 A 遗留） |
| `scripts/validate.sh` | 增加了对 user-dashboard 的校验 |

### 关键配置位置

**nginx 注入脚本**（约第 111-114 行、127-130 行）：
```
sub_filter '</body>' '...<script src="/theme/jumping/theme-dashboard-modules.js?v=20260337"></script></body>';
```

**jumping-theme 挂载**（compose.yaml）：
```yaml
- ./jumping-theme:/www/public/theme/jumping:ro
```
脚本通过 `/theme/jumping/theme-dashboard-modules.js` 访问，由 web 容器提供。

---

## 四、可能存在的问题（未验证）

1. **DOM 选择器**：`findTarget()` 使用 `.n-layout-content`、`.n-scrollbar-content` 等选择器查找插入位置。Xboard 实际 DOM 结构可能不同，导致插入位置错误或找不到目标。

2. **Token 获取**：脚本从 localStorage 读取 `auth_data`、`token` 等。Xboard SPA 的存储 key 可能不同，需在浏览器中实际确认。

3. **Notice API 返回格式**：`/api/v1/user/notice/fetch` 返回 `{ data: [...], total: N }`，脚本取 `data.data` 得到数组。若 Xboard 版本不同，格式可能变化。

4. **流量统计**：当前使用 `getTrafficLog`，返回的是**本月**按倍率分组的流量，不是「72 小时节点流量」。若需要 72 小时，需后端扩展接口。

5. **ECharts**：脚本在无 echarts 时动态加载 CDN。若生产环境限制外网，可能加载失败。

---

## 五、建议下一位 Agent 的排查步骤

1. **确认脚本是否加载**
   - 打开 https://jumpingnow.com/user ，登录后进入仪表盘
   - F12 → Network，搜索 `theme-dashboard-modules.js`，确认是否 200

2. **确认模块是否注入**
   - F12 → Elements，搜索 `jumping-dashboard-modules`
   - 若存在，说明注入成功；若不存在，检查 `isDashboard()` 和 `findTarget()` 逻辑

3. **若注入成功但无数据**
   - F12 → Network，查看 `/api/v1/user/info`、`getSubscribe` 等请求是否成功
   - 检查 Console 是否有 401/403，可能是 token 未正确传递

4. **若找不到插入目标**
   - 在 https://jumpingnow.com/user#/dashboard 打开 F12
   - 查看实际 DOM 结构，找到主内容区域的 class 或 id
   - 修改 `theme-dashboard-modules.js` 中 `findTarget()` 的 `sel` 数组

5. **清理方案 A 遗留**
   - 删除 `user-dashboard/` 目录
   - 从 `compose.yaml` 的 nginx volumes 中移除 `./user-dashboard`
   - 从 `scripts/validate.sh` 中移除 user-dashboard 相关校验

---

## 六、Xboard API 参考（已确认存在）

| 接口 | 说明 |
|------|------|
| GET /api/v1/user/info | 用户信息（balance, commission_balance, expired_at, last_login_at 等） |
| GET /api/v1/user/getSubscribe | 订阅信息（subscribe_url, transfer_enable, u, d, plan, next_reset_at 等） |
| GET /api/v1/user/notice/fetch | 公告列表 |
| GET /api/v1/user/stat/getTrafficLog | 本月流量（按 server_rate 分组） |

认证：请求头 `Authorization: Bearer <token>`，token 来自登录后 SPA 的 localStorage。

---

## 七、总结

- **正确方向**：在 `/user#/dashboard` 内通过注入脚本添加模块（方案 B）
- **未解决**：未在生产环境完整验证；DOM 选择器、token 获取、API 格式可能需根据实际环境调整
- **可删除**：`user-dashboard/` 及相关 nginx、compose、validate 配置（方案 A 遗留）
