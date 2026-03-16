/**
 * Jumping 仪表盘扩展 v3
 * 在 /user#/dashboard 注入：摘要卡片、客户端下载、订阅地址、公告、流量统计
 * 支持亮色/暗色双主题，自适应 Xboard NaiveUI 布局
 */
(function () {
  'use strict';

  var INJECT_ID = 'JDM';
  var API_BASE = '/api/v1';

  /* ─── Token ─────────────────────────────────────────────── */
  function getToken() {
    var i, v, key, obj, found;

    /* Xboard Naive UI theme: key = "VUE_NAIVE_ACCESS_TOKEN", value = JSON {value, time, expire} */
    var xboardKey = 'VUE_NAIVE_ACCESS_TOKEN';
    try {
      v = localStorage.getItem(xboardKey) || sessionStorage.getItem(xboardKey);
      if (v) {
        obj = JSON.parse(v);
        if (obj && obj.value && obj.value.length > 10) {
          var now = Date.now();
          if (!obj.expire || obj.expire > now) {
            return obj.value.startsWith('Bearer ') ? obj.value : 'Bearer ' + obj.value;
          }
        }
      }
    } catch (_) {}

    /* Fallback: scan all storage keys */
    var TOKEN_KEYS = ['token', 'auth_data', 'auth_token', 'xboard_token', 'access_token', 'Authorization'];
    for (i = 0; i < TOKEN_KEYS.length; i++) {
      v = localStorage.getItem(TOKEN_KEYS[i]) || sessionStorage.getItem(TOKEN_KEYS[i]);
      if (v && v.length > 10) return v.startsWith('Bearer ') ? v : 'Bearer ' + v;
    }
    for (i = 0; i < localStorage.length; i++) {
      key = localStorage.key(i);
      if (!key || !/auth|token|session/i.test(key)) continue;
      try {
        v = localStorage.getItem(key);
        if (!v) continue;
        if (v.charAt(0) === '{') {
          obj = JSON.parse(v);
          found = obj.value || obj.auth_data || obj.token || obj.access_token;
          if (found && typeof found === 'string' && found.length > 10) {
            return found.startsWith('Bearer ') ? found : 'Bearer ' + found;
          }
        } else if (v.length > 20 && !/^[{[\s]/.test(v)) {
          return 'Bearer ' + v;
        }
      } catch (_) {}
    }
    return null;
  }

  /* ─── API ────────────────────────────────────────────────── */
  function api(path) {
    var token = getToken();
    var headers = { Accept: 'application/json' };
    if (token) headers['Authorization'] = token;
    return fetch(API_BASE + path, { headers: headers, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .catch(function () { return {}; })
      .then(function (d) {
        if (!d || d.status === 'fail') return null;
        return d.data !== undefined ? d.data : d;
      });
  }

  /* ─── Format ─────────────────────────────────────────────── */
  function fmtBytes(b) {
    if (!b || b <= 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), 4);
    return (b / Math.pow(1024, i)).toFixed(2) + ' ' + u[i];
  }
  function fmtDate(ts) {
    if (!ts) return '--';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function fmtDT(ts) {
    if (!ts) return '--';
    var d = new Date(ts * 1000);
    return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function p2(n) { return String(n).padStart(2, '0'); }

  /* ─── DOM helpers ────────────────────────────────────────── */
  function isDashboard() {
    var p = window.location.pathname;
    var h = window.location.hash || '#/';
    return (p === '/user' || p.endsWith('/user')) &&
      (h === '#/dashboard' || h === '#/' || h === '#');
  }

  function isDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    var stored = localStorage.getItem('jumping-theme') || localStorage.getItem('theme') || 'dark';
    return stored !== 'light';
  }

  /**
   * 找主内容滚动区域 — 确定性方法，不依赖猜测类名。
   *
   * 核心思路：
   *   1. 找 .n-layout-sider（侧边栏），确定其父节点（外层 flex 容器）
   *   2. 在父节点的子元素中找"不是侧边栏"的那个 → 就是主内容面板
   *   3. 在主内容面板里找 NaiveUI 的滚动容器（可选），否则直接用最深的单子节点
   *
   * 这样绝对不会误选外层容器或侧边栏。
   */
  function findTarget() {
    var sider = document.querySelector('.n-layout-sider');
    if (!sider) return null;

    /* ① 找侧边栏的父节点（外层 flex 容器） */
    var outerLayout = sider.parentNode;
    if (!outerLayout) return null;

    /* ② 找外层容器里"不是侧边栏"的那个子元素 = 主内容面板 */
    var mainPanel = null;
    for (var i = 0; i < outerLayout.children.length; i++) {
      if (outerLayout.children[i] !== sider) {
        mainPanel = outerLayout.children[i];
        break;
      }
    }
    if (!mainPanel || mainPanel.offsetWidth < 100) return null;

    /* ③ 在主内容面板里找 NaiveUI 滚动容器（可选） */
    var sc = mainPanel.querySelector('.n-scrollbar-content, .n-layout-scroll-container');
    if (sc && sc.offsetHeight > 30 && !sc.contains(sider)) return sc;

    /* ④ 没有 NaiveUI 类时，沿单子节点往下钻，找最深的实质容器 */
    var cur = mainPanel;
    var depth = 0;
    while (cur.children.length === 1 && depth < 8) {
      var child = cur.children[0];
      if (child.offsetHeight > 30) { cur = child; }
      else break;
      depth++;
    }

    return cur;
  }

  /* ─── Styles ─────────────────────────────────────────────── */
  var CSS = [
    /* wrapper: 必须有 display:block 防止被父级 flex/grid 拉伸变形 */
    '#JDM{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin-bottom:24px;box-sizing:border-box;display:block;width:100%;float:none;position:static;}',
    '#JDM *{box-sizing:border-box;}',

    /* ── 顶部4卡片 ── */
    '#JDM .jdm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;}',
    '@media(max-width:960px){#JDM .jdm-stats{grid-template-columns:repeat(2,1fr);}}',
    '@media(max-width:540px){#JDM .jdm-stats{grid-template-columns:1fr;}}',

    '#JDM .jdm-stat{border-radius:16px;padding:20px 20px 16px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;}',
    '#JDM .jdm-stat:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.12);}',

    /* 亮色渐变 */
    '#JDM .jdm-stat.s1{background:linear-gradient(135deg,#e8f8f5 0%,#c8eee6 100%);}',
    '#JDM .jdm-stat.s2{background:linear-gradient(135deg,#e8f0ff 0%,#c6d9ff 100%);}',
    '#JDM .jdm-stat.s3{background:linear-gradient(135deg,#fff4e0 0%,#ffdfa3 100%);}',
    '#JDM .jdm-stat.s4{background:linear-gradient(135deg,#fce8f0 0%,#f8c9de 100%);}',

    /* 暗色覆盖 */
    '[data-theme="dark"] #JDM .jdm-stat.s1{background:linear-gradient(135deg,rgba(0,210,160,.12),rgba(0,180,140,.06));}',
    '[data-theme="dark"] #JDM .jdm-stat.s2{background:linear-gradient(135deg,rgba(80,140,255,.12),rgba(0,100,255,.06));}',
    '[data-theme="dark"] #JDM .jdm-stat.s3{background:linear-gradient(135deg,rgba(255,170,0,.12),rgba(230,140,0,.06));}',
    '[data-theme="dark"] #JDM .jdm-stat.s4{background:linear-gradient(135deg,rgba(255,60,100,.12),rgba(220,30,80,.06));}',

    '#JDM .jdm-stat-icon{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:22px;flex-shrink:0;}',
    '#JDM .jdm-stat.s1 .jdm-stat-icon{background:rgba(0,200,150,.22);}',
    '#JDM .jdm-stat.s2 .jdm-stat-icon{background:rgba(60,120,255,.2);}',
    '#JDM .jdm-stat.s3 .jdm-stat-icon{background:rgba(255,165,0,.25);}',
    '#JDM .jdm-stat.s4 .jdm-stat-icon{background:rgba(255,60,100,.2);}',

    '#JDM .jdm-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#888;margin-bottom:5px;}',
    '#JDM .jdm-stat-val{font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '[data-theme="dark"] #JDM .jdm-stat-val{color:#f0f0f0;}',
    '#JDM .jdm-stat-sub{font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* ── 通用卡片 ── */
    '#JDM .jdm-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}',
    '@media(max-width:720px){#JDM .jdm-row{grid-template-columns:1fr;}}',

    '#JDM .jdm-card{background:#fff;border-radius:16px;padding:20px;border:1px solid rgba(0,0,0,.06);transition:box-shadow .2s;}',
    '[data-theme="dark"] #JDM .jdm-card{background:rgba(28,28,30,.75);border-color:rgba(255,255,255,.06);}',

    '#JDM .jdm-card-title{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:14px;display:flex;align-items:center;gap:6px;}',
    '[data-theme="dark"] #JDM .jdm-card-title{color:#f0f0f0;}',

    /* ── OS 标签页 ── */
    '#JDM .jdm-os-tabs{display:flex;gap:0;margin-bottom:14px;border-bottom:1px solid rgba(0,0,0,.08);overflow-x:auto;}',
    '[data-theme="dark"] #JDM .jdm-os-tabs{border-color:rgba(255,255,255,.08);}',
    '#JDM .jdm-os-tab{padding:8px 14px;font-size:13px;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;color:#666;transition:color .2s,border-color .2s;white-space:nowrap;outline:none;}',
    '#JDM .jdm-os-tab.active{color:#18a058;border-bottom-color:#18a058;font-weight:600;}',
    '[data-theme="dark"] #JDM .jdm-os-tab{color:#999;}',
    '[data-theme="dark"] #JDM .jdm-os-tab.active{color:#63e2b7;border-bottom-color:#63e2b7;}',
    '#JDM .jdm-os-panel{display:none;}',
    '#JDM .jdm-os-panel.active{display:block;}',

    /* 客户端列表 */
    '#JDM .jdm-client{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05);gap:12px;}',
    '[data-theme="dark"] #JDM .jdm-client{border-color:rgba(255,255,255,.05);}',
    '#JDM .jdm-client:last-child{border-bottom:none;}',
    '#JDM .jdm-client-logo{width:36px;height:36px;border-radius:8px;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}',
    '[data-theme="dark"] #JDM .jdm-client-logo{background:rgba(255,255,255,.08);}',
    '#JDM .jdm-client-info{flex:1;min-width:0;}',
    '#JDM .jdm-client-name{font-size:13px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '[data-theme="dark"] #JDM .jdm-client-name{color:#ddd;}',
    '#JDM .jdm-client-ver{font-size:11px;color:#999;margin-top:2px;}',
    '#JDM .jdm-client-dl{padding:5px 12px;background:#18a058;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;text-decoration:none;white-space:nowrap;display:inline-block;}',
    '#JDM .jdm-client-dl:hover{background:#10865e;}',

    /* ── 订阅地址按钮 ── */
    '#JDM .jdm-subs{display:flex;flex-wrap:wrap;gap:8px;}',
    '#JDM .jdm-sub{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:none;color:#fff;transition:filter .2s,transform .1s;white-space:nowrap;}',
    '#JDM .jdm-sub:hover{filter:brightness(1.15);}',
    '#JDM .jdm-sub:active{transform:scale(.96);}',
    '#JDM .jdm-sub .arrow{font-size:10px;opacity:.8;}',
    '#JDM .jdm-sub .tick{display:none;}',
    '#JDM .jdm-sub.copied .tick{display:inline;}',
    '#JDM .jdm-sub.copied .arrow{display:none;}',

    '#JDM .jdm-sub.p-ssr{background:#2c2c2c;}',
    '#JDM .jdm-sub.p-clash{background:#1a1a2e;}',
    '#JDM .jdm-sub.p-surge{background:#5b5fc7;}',
    '#JDM .jdm-sub.p-shadow{background:#333;}',
    '#JDM .jdm-sub.p-stash{background:#4a4a5e;}',
    '#JDM .jdm-sub.p-qx{background:#7c3aed;}',
    '#JDM .jdm-sub.p-v2ray{background:#e04e39;}',
    '#JDM .jdm-sub.p-vless{background:#c0392b;}',
    '#JDM .jdm-sub.p-surf{background:#2d4f8a;}',
    '#JDM .jdm-sub.p-kitsu{background:#e67e22;}',

    /* ── 公告 ── */
    '#JDM .jdm-notice-date{font-size:12px;color:#999;margin-bottom:8px;}',
    '#JDM .jdm-notice-body{font-size:13px;line-height:1.75;color:#555;max-height:140px;overflow-y:auto;}',
    '[data-theme="dark"] #JDM .jdm-notice-body{color:#aaa;}',
    '#JDM .jdm-notice-body a{color:#18a058;}',

    /* ── 流量图 ── */
    '#JDM .jdm-chart-wrap{height:210px;}',
    '#JDM .jdm-progress-wrap{margin-bottom:10px;}',
    '#JDM .jdm-progress-label{display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:5px;}',
    '#JDM .jdm-progress-bar{height:6px;border-radius:3px;background:rgba(0,0,0,.08);overflow:hidden;}',
    '[data-theme="dark"] #JDM .jdm-progress-bar{background:rgba(255,255,255,.1);}',
    '#JDM .jdm-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#18a058,#4fc3a1);}',

    /* empty state */
    '#JDM .jdm-empty{text-align:center;padding:30px 0;color:#bbb;font-size:13px;}',
  ].join('');

  /* ─── Protocol buttons config ─────────────────────────────── */
  var PROTOCOLS = [
    { n: 'SSR 订阅',      f: 'ssr',          c: 'p-ssr',    icon: '✈️' },
    { n: 'Clash 订阅',    f: 'clash',        c: 'p-clash',  icon: '⚡' },
    { n: 'Surge 订阅',    f: 'surge',        c: 'p-surge',  icon: '🌊' },
    { n: 'Shadowrocket',  f: 'shadowrocket', c: 'p-shadow', icon: '🚀' },
    { n: 'Stash 订阅',    f: 'stash',        c: 'p-stash',  icon: '💼' },
    { n: 'Quantumult X',  f: 'quantumultx',  c: 'p-qx',     icon: '🔮' },
    { n: 'V2Ray 订阅',    f: 'v2rayn',       c: 'p-v2ray',  icon: '📡' },
    { n: 'V2Ray-VLESS',   f: 'vless',        c: 'p-vless',  icon: '🛰️' },
    { n: 'Surfboard',     f: 'surfboard',    c: 'p-surf',   icon: '🏄' },
    { n: 'Kitsunebi',     f: 'kitsunebi',    c: 'p-kitsu',  icon: '🦊' },
  ];

  /* ─── OS list ─────────────────────────────────────────────── */
  var OS_LIST = [
    { id: 'windows', label: 'Windows',    icon: '🪟', kw: /windows|win/i },
    { id: 'android', label: 'Android',    icon: '🤖', kw: /android/i },
    { id: 'macos',   label: 'Mac OS',     icon: '🍎', kw: /mac|macos|osx/i },
    { id: 'ios',     label: 'iPhone OS',  icon: '📱', kw: /ios|iphone|ipad/i },
  ];

  /* ─── HTML template ──────────────────────────────────────── */
  function buildHTML() {
    var osTabs = OS_LIST.map(function (os, i) {
      return '<button class="jdm-os-tab' + (i === 0 ? ' active' : '') + '" data-os="' + os.id + '">' +
        os.icon + ' ' + os.label + '</button>';
    }).join('');
    var osPanels = OS_LIST.map(function (os, i) {
      return '<div class="jdm-os-panel' + (i === 0 ? ' active' : '') + '" id="jdm-os-' + os.id + '">' +
        '<div class="jdm-empty">加载中…</div></div>';
    }).join('');

    return (
      '<style id="jdm-css">' + CSS + '</style>' +
      /* stats */
      '<div class="jdm-stats">' +
        '<div class="jdm-stat s1"><div class="jdm-stat-icon">👤</div>' +
          '<div class="jdm-stat-label">会员时长</div>' +
          '<div class="jdm-stat-val" id="jdm-days">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-member">--</div></div>' +
        '<div class="jdm-stat s2"><div class="jdm-stat-icon">💧</div>' +
          '<div class="jdm-stat-label">剩余流量</div>' +
          '<div class="jdm-stat-val" id="jdm-traffic">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-reset">--</div></div>' +
        '<div class="jdm-stat s3"><div class="jdm-stat-icon">📱</div>' +
          '<div class="jdm-stat-label">在线设备</div>' +
          '<div class="jdm-stat-val" id="jdm-device">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-last">--</div></div>' +
        '<div class="jdm-stat s4"><div class="jdm-stat-icon">💰</div>' +
          '<div class="jdm-stat-label">钱包余额</div>' +
          '<div class="jdm-stat-val" id="jdm-wallet">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-rebate">--</div></div>' +
      '</div>' +
      /* row 2 */
      '<div class="jdm-row">' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title">📥 客户端下载教程</div>' +
          '<div class="jdm-os-tabs">' + osTabs + '</div>' +
          osPanels +
        '</div>' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title">🔗 订阅地址</div>' +
          '<div class="jdm-subs" id="jdm-subs"><div class="jdm-empty">加载中…</div></div>' +
        '</div>' +
      '</div>' +
      /* row 3 */
      '<div class="jdm-row">' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title">📢 最新公告</div>' +
          '<div class="jdm-notice-date" id="jdm-notice-date"></div>' +
          '<div class="jdm-notice-body" id="jdm-notice-body">暂无公告</div>' +
        '</div>' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title">📊 流量统计</div>' +
          '<div class="jdm-chart-wrap" id="jdm-chart"></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ─── Render helpers ─────────────────────────────────────── */
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderStats(info, sub) {
    info = info || {}; sub = sub || {};
    var now = Math.floor(Date.now() / 1000);
    var exp = info.expired_at || 0;
    var days = exp > now ? Math.ceil((exp - now) / 86400) : 0;
    setText('jdm-days',   days + ' 天');
    setText('jdm-member', ((sub.plan && sub.plan.name) || '未订阅') + ': ' + fmtDate(exp) + ' 到期');

    var total = sub.transfer_enable || 0, used = (sub.u || 0) + (sub.d || 0);
    var remain = Math.max(0, total - used);
    setText('jdm-traffic', fmtBytes(remain));
    setText('jdm-reset',   '下次重置: ' + (sub.next_reset_at ? fmtDT(sub.next_reset_at) : '未购买套餐'));

    /* traffic progress bar */
    if (total > 0) {
      var pct = Math.min(100, ((used / total) * 100)).toFixed(1);
      var trafficEl = document.getElementById('jdm-traffic');
      if (trafficEl && trafficEl.parentNode) {
        var prog = document.createElement('div');
        prog.className = 'jdm-progress-wrap';
        prog.innerHTML = '<div class="jdm-progress-label"><span>' + fmtBytes(used) + ' 已用</span><span>' + fmtBytes(total) + ' 总量</span></div>' +
          '<div class="jdm-progress-bar"><div class="jdm-progress-fill" style="width:' + pct + '%;' +
            (parseFloat(pct) > 80 ? 'background:linear-gradient(90deg,#e04e39,#ff7043);' : '') + '"></div></div>';
        trafficEl.parentNode.insertBefore(prog, trafficEl.nextSibling);
      }
    }

    setText('jdm-device', '1 / ' + (sub.device_limit != null ? sub.device_limit : '无限制'));
    setText('jdm-last',   '上次使用: ' + fmtDT(info.last_login_at));

    var bal = (info.balance || 0) / 100, reb = (info.commission_balance || 0) / 100;
    setText('jdm-wallet',  '¥' + bal.toFixed(2));
    setText('jdm-rebate',  '返利累计: ¥' + reb.toFixed(2));
  }

  function renderDownloads(knowledge) {
    var osMap = {};
    OS_LIST.forEach(function (os) { osMap[os.id] = []; });

    (knowledge || []).forEach(function (k) {
      var text = (k.title || '') + ' ' + (k.category || '');
      OS_LIST.forEach(function (os) {
        if (os.kw.test(text)) osMap[os.id].push(k);
      });
    });

    OS_LIST.forEach(function (os) {
      var container = document.getElementById('jdm-os-' + os.id);
      if (!container) return;
      var items = osMap[os.id];
      if (!items.length) {
        container.innerHTML = '<div class="jdm-empty">暂无 ' + os.label + ' 教程</div>';
        return;
      }
      container.innerHTML = items.slice(0, 6).map(function (k) {
        var link = k.url || '#';
        var ver  = k.version ? '<div class="jdm-client-ver">' + k.version + '</div>' : '';
        return '<div class="jdm-client">' +
          '<div class="jdm-client-logo">' + os.icon + '</div>' +
          '<div class="jdm-client-info"><div class="jdm-client-name">' + (k.title || '客户端') + '</div>' + ver + '</div>' +
          '<a class="jdm-client-dl" href="' + link + '" target="_blank" rel="noopener noreferrer">点击下载</a>' +
          '</div>';
      }).join('');
    });
  }

  function renderSubscriptions(sub) {
    var subEl = document.getElementById('jdm-subs');
    if (!subEl) return;
    var subUrl = (sub && sub.subscribe_url) || '';
    if (!subUrl) {
      subEl.innerHTML = '<div class="jdm-empty">暂无订阅地址</div>';
      return;
    }
    subEl.innerHTML = '';
    PROTOCOLS.forEach(function (p) {
      var url = subUrl + (subUrl.indexOf('?') >= 0 ? '&' : '?') + 'flag=' + p.f;
      var btn = document.createElement('button');
      btn.className = 'jdm-sub ' + p.c;
      btn.innerHTML = p.icon + ' ' + p.n + '<span class="arrow"> ▾</span><span class="tick"> ✓ 已复制</span>';
      btn.title = '复制 ' + p.n + ' 订阅链接';
      btn.onclick = function () {
        (navigator.clipboard
          ? navigator.clipboard.writeText(url)
          : Promise.resolve(fallbackCopy(url))
        ).then(function () {
          btn.classList.add('copied');
          setTimeout(function () { btn.classList.remove('copied'); }, 1600);
        });
      };
      subEl.appendChild(btn);
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  function renderNotice(notices) {
    var latest = (notices || [])[0];
    if (!latest) return;
    setText('jdm-notice-date', '更新于: ' + fmtDT(latest.created_at || latest.updated_at));
    var body = document.getElementById('jdm-notice-body');
    if (body) body.innerHTML = latest.content || latest.title || '暂无公告内容';
  }

  function renderChart(traffic) {
    var chartEl = document.getElementById('jdm-chart');
    if (!chartEl) return;

    /* group by date, last 30 records max */
    var byDate = {};
    (Array.isArray(traffic) ? traffic : []).slice(-30).forEach(function (r) {
      var ts = r.record_at || r.created_at || 0;
      if (!ts) return;
      var d = new Date(ts * 1000);
      var key = p2(d.getMonth() + 1) + '/' + p2(d.getDate());
      byDate[key] = (byDate[key] || 0) + (r.u || 0) + (r.d || 0);
    });

    var keys = Object.keys(byDate).sort();
    var vals = keys.map(function (k) { return +(byDate[k] / 1073741824).toFixed(3); });

    if (!keys.length) {
      chartEl.innerHTML = '<div class="jdm-empty">暂无流量数据</div>';
      return;
    }

    function draw(ec) {
      var chart = ec.init(chartEl, isDark() ? 'dark' : null);
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          formatter: function (p) { return p[0].name + ': ' + p[0].value + ' GB'; }
        },
        grid: { left: 44, right: 12, top: 14, bottom: 28 },
        xAxis: {
          type: 'category', data: keys,
          axisLabel: { fontSize: 10, color: isDark() ? '#888' : '#666' },
          axisLine: { lineStyle: { color: isDark() ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { formatter: '{value}G', fontSize: 10, color: isDark() ? '#888' : '#666' },
          splitLine: { lineStyle: { color: isDark() ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)' } }
        },
        series: [{
          type: 'bar', data: vals, barMaxWidth: 36,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#18a058' }, { offset: 1, color: '#4fc3a1' }]
            },
            borderRadius: [4, 4, 0, 0]
          }
        }]
      });
    }

    if (window.echarts) {
      draw(window.echarts);
    } else {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
      s.onload = function () { if (window.echarts) draw(window.echarts); };
      document.head.appendChild(s);
    }
  }

  /* ─── Main inject ────────────────────────────────────────── */
  function injectModules(target) {
    if (!isDashboard() || document.getElementById(INJECT_ID)) return;
    if (!getToken()) return;

    if (!target) target = findTarget();
    if (!target) {
      console.warn('[JDM] 未找到主内容区，跳过注入');
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = INJECT_ID;
    wrap.innerHTML = buildHTML();

    if (target.firstChild) {
      target.insertBefore(wrap, target.firstChild);
    } else {
      target.appendChild(wrap);
    }

    /* OS tab switching */
    wrap.querySelectorAll('.jdm-os-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        wrap.querySelectorAll('.jdm-os-tab').forEach(function (t) { t.classList.remove('active'); });
        wrap.querySelectorAll('.jdm-os-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('jdm-os-' + tab.dataset.os);
        if (panel) panel.classList.add('active');
      });
    });

    /* Fetch all data in parallel */
    Promise.all([
      api('/user/info'),
      api('/user/getSubscribe'),
      api('/user/notice/fetch').then(function (r) {
        if (!r) return [];
        return Array.isArray(r) ? r : (r.data || []);
      }),
      api('/user/stat/getTrafficLog').then(function (r) {
        return Array.isArray(r) ? r : [];
      }),
      api('/user/knowledge/fetch').then(function (r) {
        if (!r) return [];
        return Array.isArray(r) ? r : (r.data || []);
      }),
    ]).then(function (res) {
      renderStats(res[0], res[1]);
      renderDownloads(res[4]);
      renderSubscriptions(res[1]);
      renderNotice(res[2]);
      renderChart(res[3]);
    }).catch(function (e) {
      console.warn('[JDM] 数据加载失败:', e);
    });
  }

  /* ─── 重注入守卫（Vue 重渲染可能清除 #JDM） ─────────────── */
  var _guardObserver = null;
  var _reInjectTimer = null;
  var _tryInjectScheduled = false;

  function startGuard(target) {
    if (_guardObserver) _guardObserver.disconnect();
    /* 监听 target 的直接子节点变化：#JDM 被移除时重新注入 */
    _guardObserver = new MutationObserver(function () {
      if (!isDashboard()) return;
      if (!document.getElementById(INJECT_ID)) {
        clearTimeout(_reInjectTimer);
        _reInjectTimer = setTimeout(function () {
          if (isDashboard() && !document.getElementById(INJECT_ID)) {
            injectModules();
          }
        }, 150);
      }
    });
    _guardObserver.observe(target, { childList: true });
  }

  /* ─── Retry ──────────────────────────────────────────────── */
  function tryInject() {
    if (!isDashboard()) {
      _tryInjectScheduled = false;
      return;
    }
    var tries = 0;
    var hasContent = false;

    var timer = setInterval(function () {
      tries++;
      var target = findTarget();
      if (!target) {
        if (tries > 80) {
          clearInterval(timer);
          _tryInjectScheduled = false;
        }
        return;
      }

      /* 等 Vue 把内容渲染进去（target 有子元素）再注入，避免被 Vue 清除 */
      if (!hasContent && target.children.length > 0) {
        hasContent = true;
        clearInterval(timer);
        /* 额外等 400ms 让 Vue 完成所有后处理 */
        var capturedTarget = target; /* 闭包捕获已验证的 target */
        setTimeout(function () {
          if (isDashboard() && !document.getElementById(INJECT_ID)) {
            injectModules(capturedTarget);
            startGuard(capturedTarget);
          }
          _tryInjectScheduled = false;
        }, 400);
      }

      if (tries > 80) {
        clearInterval(timer);
        _tryInjectScheduled = false;
      }
    }, 200);
  }

  function removeModules() {
    clearTimeout(_reInjectTimer);
    _reInjectTimer = null;
    _tryInjectScheduled = false;
    if (_guardObserver) { _guardObserver.disconnect(); _guardObserver = null; }
    var el = document.getElementById(INJECT_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /** 根据当前路由同步：非 dashboard 必须移除模块；在 dashboard 且无模块则尝试注入（SPA 不刷新页面，hashchange 可能不触发）*/
  function syncRoute() {
    var onDash = isDashboard();
    var hasMod = !!document.getElementById(INJECT_ID);
    if (hasMod && !onDash) {
      removeModules();
      return;
    }
    if (!hasMod && onDash && getToken() && !_tryInjectScheduled) {
      _tryInjectScheduled = true;
      setTimeout(function () {
        tryInject();
      }, 200);
    }
  }

  /* ─── Init ───────────────────────────────────────────────── */
  function init() {
    tryInject();
    setInterval(syncRoute, 280);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);
})();
