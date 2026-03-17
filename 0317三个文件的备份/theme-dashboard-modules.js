/**
 * Jumping 仪表盘模块 v4
 * 深度集成 jumping.css 变量体系，所有颜色均使用 var(--jp-*) 变量。
 * 注入位置：/user#/dashboard 主内容区顶部。
 * 板块顺序（上→下）：
 *   Row 1 — 4 个统计卡片（会员 / 流量 / 设备 / 钱包）
 *   Row 2 — 客户端下载  |  订阅地址
 *   Row 3 — 最新公告    |  流量统计图
 */
(function () {
  'use strict';
  console.log('[JDM] v2026.03.17-v13');

  var INJECT_ID = 'JDM';
  var API_BASE  = '/api/v1';

  /* ─── Token ─────────────────────────────────────────────── */
  function getToken() {
    var i, v, key, obj, found;
    var xboardKey = 'VUE_NAIVE_ACCESS_TOKEN';
    try {
      v = localStorage.getItem(xboardKey) || sessionStorage.getItem(xboardKey);
      if (v) {
        obj = JSON.parse(v);
        if (obj && obj.value && obj.value.length > 10) {
          if (!obj.expire || obj.expire > Date.now()) {
            return obj.value.startsWith('Bearer ') ? obj.value : 'Bearer ' + obj.value;
          }
        }
      }
    } catch (_) {}
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
          if (found && typeof found === 'string' && found.length > 10)
            return found.startsWith('Bearer ') ? found : 'Bearer ' + found;
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

  /* ─── Helpers ────────────────────────────────────────────── */
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
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ─── 路由 & 目标检测 ────────────────────────────────────── */
  function isDashboard() {
    var p = window.location.pathname;
    var h = window.location.hash || '#/';
    return (p === '/user' || p.endsWith('/user')) &&
      (h === '#/dashboard' || h === '#/' || h === '#');
  }

  function isDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr !== 'light';
    return !document.documentElement.classList.contains('light');
  }

  /**
   * 注入目标：.cus-scroll-y 内的第一个 DIV（即 DIV.mb-1，原始内容容器）
   * 把 #JDM 插入到这个 DIV 的最前面，与原始内容完全一体、一起滚动。
   */
  function findTarget() {
    var scrollEl = document.querySelector('article.flex .cus-scroll-y');
    if (!scrollEl) return null;
    /* 取第一个实质子节点（DIV.mb-1），跳过高度为0的占位符 */
    for (var i = 0; i < scrollEl.children.length; i++) {
      if (scrollEl.children[i].offsetHeight > 0) return scrollEl.children[i];
    }
    return scrollEl;
  }

  /* ─── CSS（完全使用 jumping.css 的 var(--jp-*) 变量） ────── */
  var CSS = [
    '#JDM{font-family:var(--jp-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);margin-bottom:24px;box-sizing:border-box;display:block;width:100%;float:none;position:static;}',
    '#JDM *{box-sizing:border-box;}',

    /* ── Row 1：4 个统计卡片 ── */
    '#JDM .jdm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;}',
    '@media(max-width:960px){#JDM .jdm-stats{grid-template-columns:repeat(2,1fr);}}',
    '@media(max-width:540px){#JDM .jdm-stats{grid-template-columns:1fr;}}',

    '#JDM .jdm-stat{background:var(--jp-card);border:1px solid var(--jp-border);border-radius:16px;padding:20px 20px 16px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;}',
    '#JDM .jdm-stat:hover{transform:translateY(-3px);box-shadow:var(--jp-shadow);}',

    /* 卡片左侧彩色竖条 */
    '#JDM .jdm-stat::before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 3px 3px 0;}',
    '#JDM .jdm-stat.s1::before{background:var(--jp-primary);}',
    '#JDM .jdm-stat.s2::before{background:#30d158;}',
    '#JDM .jdm-stat.s3::before{background:#ff9f0a;}',
    '#JDM .jdm-stat.s4::before{background:#bf5af2;}',

    /* 图标区 */
    '#JDM .jdm-stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:20px;flex-shrink:0;}',
    '#JDM .jdm-stat.s1 .jdm-stat-icon{background:rgba(0,122,255,.15);}',
    '#JDM .jdm-stat.s2 .jdm-stat-icon{background:rgba(48,209,88,.15);}',
    '#JDM .jdm-stat.s3 .jdm-stat-icon{background:rgba(255,159,10,.15);}',
    '#JDM .jdm-stat.s4 .jdm-stat-icon{background:rgba(191,90,242,.15);}',

    '#JDM .jdm-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--jp-muted);margin-bottom:5px;}',
    '#JDM .jdm-stat-val{font-size:22px;font-weight:700;color:var(--jp-text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#JDM .jdm-stat-sub{font-size:12px;color:var(--jp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* ── 通用卡片（Row 2 / Row 3） ── */
    '#JDM .jdm-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}',
    '@media(max-width:720px){#JDM .jdm-row{grid-template-columns:1fr;}}',

    '#JDM .jdm-card{background:var(--jp-card);border-radius:16px;padding:20px;border:1px solid var(--jp-border);transition:box-shadow .2s;}',

    '#JDM .jdm-card-title{font-size:14px;font-weight:600;color:var(--jp-text);margin-bottom:16px;display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--jp-border);}',
    '#JDM .jdm-card-title-dot{width:6px;height:6px;border-radius:50%;background:var(--jp-primary);flex-shrink:0;}',

    /* ── OS 标签页 ── */
    '#JDM .jdm-os-tabs{display:flex;gap:0;margin-bottom:14px;border-bottom:1px solid var(--jp-border);overflow-x:auto;}',
    '#JDM .jdm-os-tab{padding:8px 14px;font-size:13px;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;color:var(--jp-muted);transition:color .2s,border-color .2s;white-space:nowrap;outline:none;font-family:var(--jp-font);}',
    '#JDM .jdm-os-tab.active{color:var(--jp-primary);border-bottom-color:var(--jp-primary);font-weight:600;}',
    '#JDM .jdm-os-tab:hover:not(.active){color:var(--jp-text);background:var(--jp-hover);}',
    '#JDM .jdm-os-panel{display:none;}',
    '#JDM .jdm-os-panel.active{display:block;}',

    /* 客户端列表 */
    '#JDM .jdm-client{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--jp-border);gap:12px;}',
    '#JDM .jdm-client:last-child{border-bottom:none;}',
    '#JDM .jdm-client-logo{width:36px;height:36px;border-radius:10px;background:var(--jp-hover);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}',
    '#JDM .jdm-client-info{flex:1;min-width:0;}',
    '#JDM .jdm-client-name{font-size:13px;font-weight:500;color:var(--jp-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#JDM .jdm-client-ver{font-size:11px;color:var(--jp-muted);margin-top:2px;}',
    '#JDM .jdm-client-dl{padding:5px 14px;background:var(--jp-primary);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;display:inline-block;transition:opacity .15s;}',
    '#JDM .jdm-client-dl:hover{opacity:.85;}',

    /* ── 订阅地址按钮 ── */
    '#JDM .jdm-subs{display:flex;flex-wrap:wrap;gap:8px;}',
    '#JDM .jdm-sub{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--jp-border);color:var(--jp-text);background:var(--jp-hover);transition:background .15s,transform .1s;white-space:nowrap;font-family:var(--jp-font);}',
    '#JDM .jdm-sub:hover{background:var(--jp-sel-bg);border-color:var(--jp-primary);color:var(--jp-primary);}',
    '#JDM .jdm-sub:active{transform:scale(.96);}',
    '#JDM .jdm-sub .arrow{font-size:10px;opacity:.6;}',
    '#JDM .jdm-sub .tick{display:none;color:#30d158;}',
    '#JDM .jdm-sub.copied .tick{display:inline;}',
    '#JDM .jdm-sub.copied .arrow{display:none;}',
    '#JDM .jdm-sub.copied{border-color:#30d158;color:#30d158;background:rgba(48,209,88,.1);}',

    /* ── 公告 ── */
    '#JDM .jdm-notice-date{font-size:12px;color:var(--jp-muted);margin-bottom:10px;}',
    '#JDM .jdm-notice-body{font-size:13px;line-height:1.8;color:var(--jp-text);max-height:150px;overflow-y:auto;}',
    '#JDM .jdm-notice-body a{color:var(--jp-primary);}',

    /* ── 进度条 ── */
    '#JDM .jdm-progress-wrap{margin-top:10px;}',
    '#JDM .jdm-progress-label{display:flex;justify-content:space-between;font-size:11px;color:var(--jp-muted);margin-bottom:5px;}',
    '#JDM .jdm-progress-bar{height:5px;border-radius:3px;background:var(--jp-hover);overflow:hidden;}',
    '#JDM .jdm-progress-fill{height:100%;border-radius:3px;background:var(--jp-primary);transition:width .6s ease;}',
    '#JDM .jdm-progress-fill.warn{background:#ff453a;}',

    /* ── 流量图 ── */
    '#JDM .jdm-chart-wrap{height:200px;}',

    /* ── 空状态 ── */
    '#JDM .jdm-empty{text-align:center;padding:28px 0;color:var(--jp-muted);font-size:13px;}',
  ].join('');

  /* ─── 协议按钮配置 ─────────────────────────────────────── */
  var PROTOCOLS = [
    { n: 'Clash',        f: 'clash',        icon: '⚡' },
    { n: 'Shadowrocket', f: 'shadowrocket', icon: '🚀' },
    { n: 'Surge',        f: 'surge',        icon: '🌊' },
    { n: 'Quantumult X', f: 'quantumultx',  icon: '🔮' },
    { n: 'Stash',        f: 'stash',        icon: '💼' },
    { n: 'V2Ray',        f: 'v2rayn',       icon: '📡' },
    { n: 'Surfboard',    f: 'surfboard',    icon: '🏄' },
    { n: 'SSR',          f: 'ssr',          icon: '✈️' },
    { n: 'VLESS',        f: 'vless',        icon: '🛰️' },
    { n: 'Kitsunebi',    f: 'kitsunebi',    icon: '🦊' },
  ];

  /* ─── OS 列表 ─────────────────────────────────────────── */
  var OS_LIST = [
    { id: 'windows', label: 'Windows',   icon: '🪟', kw: /windows|win/i },
    { id: 'android', label: 'Android',   icon: '🤖', kw: /android/i },
    { id: 'macos',   label: 'macOS',     icon: '🍎', kw: /mac|macos|osx/i },
    { id: 'ios',     label: 'iOS',       icon: '📱', kw: /ios|iphone|ipad/i },
  ];

  /* ─── HTML 骨架 ──────────────────────────────────────── */
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

      /* Row 1 — 统计卡片 */
      '<div class="jdm-stats">' +
        '<div class="jdm-stat s1">' +
          '<div class="jdm-stat-icon">👤</div>' +
          '<div class="jdm-stat-label">会员时长</div>' +
          '<div class="jdm-stat-val" id="jdm-days">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-member">--</div>' +
        '</div>' +
        '<div class="jdm-stat s2">' +
          '<div class="jdm-stat-icon">💧</div>' +
          '<div class="jdm-stat-label">剩余流量</div>' +
          '<div class="jdm-stat-val" id="jdm-traffic">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-reset">--</div>' +
          '<div id="jdm-traffic-progress"></div>' +
        '</div>' +
        '<div class="jdm-stat s3">' +
          '<div class="jdm-stat-icon">📱</div>' +
          '<div class="jdm-stat-label">在线设备</div>' +
          '<div class="jdm-stat-val" id="jdm-device">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-last">--</div>' +
        '</div>' +
        '<div class="jdm-stat s4">' +
          '<div class="jdm-stat-icon">💰</div>' +
          '<div class="jdm-stat-label">钱包余额</div>' +
          '<div class="jdm-stat-val" id="jdm-wallet">--</div>' +
          '<div class="jdm-stat-sub" id="jdm-rebate">--</div>' +
        '</div>' +
      '</div>' +

      /* Row 2 — 客户端 | 订阅 */
      '<div class="jdm-row">' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title"><span class="jdm-card-title-dot"></span>客户端下载</div>' +
          '<div class="jdm-os-tabs">' + osTabs + '</div>' +
          osPanels +
        '</div>' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title"><span class="jdm-card-title-dot"></span>订阅地址</div>' +
          '<div class="jdm-subs" id="jdm-subs"><div class="jdm-empty">加载中…</div></div>' +
        '</div>' +
      '</div>' +

      /* Row 3 — 公告 | 流量图 */
      '<div class="jdm-row">' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title"><span class="jdm-card-title-dot"></span>最新公告</div>' +
          '<div class="jdm-notice-date" id="jdm-notice-date"></div>' +
          '<div class="jdm-notice-body" id="jdm-notice-body">暂无公告</div>' +
        '</div>' +
        '<div class="jdm-card">' +
          '<div class="jdm-card-title"><span class="jdm-card-title-dot"></span>流量统计</div>' +
          '<div class="jdm-chart-wrap" id="jdm-chart"></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ─── 渲染：统计卡片 ─────────────────────────────────── */
  function renderStats(info, sub) {
    info = info || {}; sub = sub || {};
    var now = Math.floor(Date.now() / 1000);
    var exp = info.expired_at || 0;
    var days = exp > now ? Math.ceil((exp - now) / 86400) : 0;
    setText('jdm-days',   days + ' 天');
    setText('jdm-member', ((sub.plan && sub.plan.name) || '未订阅') + ' · ' + fmtDate(exp) + ' 到期');

    var total = sub.transfer_enable || 0;
    var used  = (sub.u || 0) + (sub.d || 0);
    var remain = Math.max(0, total - used);
    setText('jdm-traffic', fmtBytes(remain));
    setText('jdm-reset',   '重置: ' + (sub.next_reset_at ? fmtDT(sub.next_reset_at) : '未购买套餐'));

    /* 流量进度条 */
    if (total > 0) {
      var pct = Math.min(100, (used / total) * 100);
      var progEl = document.getElementById('jdm-traffic-progress');
      if (progEl) {
        var warn = pct > 80 ? ' warn' : '';
        progEl.innerHTML =
          '<div class="jdm-progress-wrap">' +
            '<div class="jdm-progress-label">' +
              '<span>' + fmtBytes(used) + ' 已用</span>' +
              '<span>' + fmtBytes(total) + ' 总量</span>' +
            '</div>' +
            '<div class="jdm-progress-bar">' +
              '<div class="jdm-progress-fill' + warn + '" style="width:' + pct.toFixed(1) + '%"></div>' +
            '</div>' +
          '</div>';
      }
    }

    setText('jdm-device', '1 / ' + (sub.device_limit != null ? sub.device_limit : '无限制'));
    setText('jdm-last',   '上次: ' + fmtDT(info.last_login_at));

    var bal = (info.balance || 0) / 100;
    var reb = (info.commission_balance || 0) / 100;
    setText('jdm-wallet',  '¥' + bal.toFixed(2));
    setText('jdm-rebate',  '返利: ¥' + reb.toFixed(2));
  }

  /* ─── 渲染：客户端下载 ───────────────────────────────── */
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
          '<div class="jdm-client-info">' +
            '<div class="jdm-client-name">' + (k.title || '客户端') + '</div>' + ver +
          '</div>' +
          '<a class="jdm-client-dl" href="' + link + '" target="_blank" rel="noopener noreferrer">下载</a>' +
        '</div>';
      }).join('');
    });
  }

  /* ─── 渲染：订阅地址 ─────────────────────────────────── */
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
      btn.className = 'jdm-sub';
      btn.innerHTML = p.icon + ' ' + p.n + '<span class="arrow"> ▾</span><span class="tick"> ✓</span>';
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

  /* ─── 渲染：公告 ─────────────────────────────────────── */
  function renderNotice(notices) {
    var latest = (notices || [])[0];
    if (!latest) return;
    setText('jdm-notice-date', '更新于 ' + fmtDT(latest.created_at || latest.updated_at));
    var body = document.getElementById('jdm-notice-body');
    if (body) body.innerHTML = latest.content || latest.title || '暂无公告内容';
  }

  /* ─── 渲染：流量统计图 ───────────────────────────────── */
  function renderChart(traffic) {
    renderChart._lastTraffic = traffic; /* 缓存数据，供主题切换时重绘 */
    var chartEl = document.getElementById('jdm-chart');
    if (!chartEl) return;

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
      var dark = isDark();
      var primary = getComputedStyle(document.documentElement).getPropertyValue('--jp-primary').trim() || '#007aff';
      var muted   = getComputedStyle(document.documentElement).getPropertyValue('--jp-muted').trim()   || '#86868b';
      var border  = getComputedStyle(document.documentElement).getPropertyValue('--jp-border').trim()  || 'rgba(255,255,255,.07)';

      var chart = ec.init(chartEl, null, { renderer: 'svg' });
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--jp-card').trim() || '#1c1c1e',
          borderColor: border,
          textStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--jp-text').trim() || '#fff', fontSize: 12 },
          formatter: function (p) { return p[0].name + ': ' + p[0].value + ' GB'; }
        },
        grid: { left: 44, right: 12, top: 14, bottom: 28 },
        xAxis: {
          type: 'category', data: keys,
          axisLabel: { fontSize: 10, color: muted },
          axisLine: { lineStyle: { color: border } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { formatter: '{value}G', fontSize: 10, color: muted },
          splitLine: { lineStyle: { color: border } }
        },
        series: [{
          type: 'bar', data: vals, barMaxWidth: 32,
          itemStyle: {
            color: primary,
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

  /* ─── 注入主函数 ─────────────────────────────────────── */
  function injectModules(target) {
    if (!isDashboard() || document.getElementById(INJECT_ID)) return;
    if (!target) target = findTarget();
    if (!target) { console.warn('[JDM] 未找到主内容区'); return; }

    var wrap = document.createElement('div');
    wrap.id = INJECT_ID;
    wrap.innerHTML = buildHTML();

    /* 插到最前面，原始内容（我的订阅/捷径等）保持在下方，一起滚动 */
    target.insertBefore(wrap, target.firstChild);

    /* OS 标签切换 */
    wrap.querySelectorAll('.jdm-os-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        wrap.querySelectorAll('.jdm-os-tab').forEach(function (t) { t.classList.remove('active'); });
        wrap.querySelectorAll('.jdm-os-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('jdm-os-' + tab.dataset.os);
        if (panel) panel.classList.add('active');
      });
    });
  }

  /* ─── 数据加载 ───────────────────────────────────────── */
  function loadData() {
    Promise.all([
      api('/user/info'),
      api('/user/getSubscribe'),
      api('/user/notice/fetch').then(function (r) { return Array.isArray(r) ? r : (r && r.data) || []; }),
      api('/user/stat/getTrafficLog').then(function (r) { return Array.isArray(r) ? r : []; }),
      api('/user/knowledge/fetch').then(function (r) { return Array.isArray(r) ? r : (r && r.data) || []; }),
    ]).then(function (res) {
      renderStats(res[0], res[1]);
      renderDownloads(res[4]);
      renderSubscriptions(res[1]);
      renderNotice(res[2]);
      renderChart(res[3]);
    }).catch(function (e) { console.warn('[JDM] 数据加载失败:', e); });
  }

  /* ─── 初始化 ────────────────────────────────────────── */
  var _domObs = null;   /* 监听 DOM 等待注入目标出现 */
  var _themeObs = null; /* 监听明暗主题切换 */

  function removeModules() {
    var el = document.getElementById(INJECT_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function tryInjectNow() {
    if (!isDashboard()) { removeModules(); return; }
    if (document.getElementById(INJECT_ID)) return;
    var target = findTarget();
    if (target && target.children.length > 0) {
      injectModules(target);
      loadData();
      /* 注入成功后继续保持 _domObs 运行：
         Vue 路由切走再切回时，#JDM 会被删除，observer 会再次触发 tryInjectNow 重新注入 */
    }
  }

  /* ─── 明暗主题切换监听 ───────────────────────────────── */
  function startThemeObserver() {
    if (_themeObs) return;
    _themeObs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === 'data-theme' || m.attributeName === 'class') {
          /* 主题变化时，若 echarts 图表已存在则重绘 */
          var chartEl = document.getElementById('jdm-chart');
          if (chartEl && window.echarts) {
            var chart = window.echarts.getInstanceByDom(chartEl);
            if (chart) {
              chart.dispose();
              renderChart._lastTraffic && renderChart(renderChart._lastTraffic);
            }
          }
        }
      });
    });
    _themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  }

  function startDomObserver() {
    if (_domObs) return;
    _domObs = new MutationObserver(function () { tryInjectNow(); });
    _domObs.observe(document.body, { childList: true, subtree: true });
  }

  function onRouteChange() {
    removeModules();
    if (isDashboard()) {
      tryInjectNow();    /* 若 DOM 已就绪直接注入 */
      startDomObserver(); /* 否则等待，同时用于路由切回后的重注入 */
    } else {
      /* 离开 dashboard：停止 DOM 监听，但保留 themeObs（全局有效） */
      if (_domObs) { _domObs.disconnect(); _domObs = null; }
    }
  }

  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('popstate', onRouteChange);

  startThemeObserver(); /* 全局监听主题，与路由无关 */
  onRouteChange();
})();
