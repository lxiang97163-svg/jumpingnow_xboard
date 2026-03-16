/**
 * Jumping 主题同步 v4 — 极简被动模式
 *
 * 原则：只读取 Xboard 的主题状态，从不干涉、不拦截 localStorage。
 * Xboard 点击月亮按钮 → NaiveUI 切换主题 → 我们感知到 → 同步 html[data-theme]
 * 这样 jumping.css 和 JDM 模块的 [data-theme="dark"] 选择器才能正常生效。
 */
(function () {
  var html = document.documentElement;
  var lastTheme = null;
  var busy = false;

  /* ─── 从多个信号源探测当前主题 ─────────────────── */
  function detectTheme() {
    /* 1. html 元素上的 class（VueUse useDark 默认在此切换） */
    if (html.classList.contains('dark'))  return 'dark';
    if (html.classList.contains('light')) return 'light';

    /* 2. html / body 的 data-theme 属性 */
    var t = html.getAttribute('data-theme') || document.body.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;

    /* 3. body 背景色（CSS 变量渲染结果：亮度 < 128 → dark） */
    try {
      var bg = window.getComputedStyle(document.body).backgroundColor;
      var nums = bg.match(/\d+/g);
      if (nums && nums.length >= 3) {
        var luma = 0.299 * +nums[0] + 0.587 * +nums[1] + 0.114 * +nums[2];
        /* 避免背景透明/未渲染时误判（luma=0 时跳过） */
        if (luma > 1) return luma < 128 ? 'dark' : 'light';
      }
    } catch (_) {}

    /* 4. 读我们自己保存的偏好 */
    return localStorage.getItem('jumping-theme') || 'dark';
  }

  /* ─── 应用主题（只写 html[data-theme]，不碰 localStorage） ── */
  function applyTheme(theme) {
    if (busy || theme === lastTheme) return;
    busy = true;
    lastTheme = theme;
    html.setAttribute('data-theme', theme);
    /* 同步保存到我们自己的 key，供 theme-default.js 下次启动时使用 */
    try { localStorage.setItem('jumping-theme', theme); } catch (_) {}
    busy = false;
  }

  function sync() {
    if (busy) return;
    applyTheme(detectTheme());
  }

  /* ─── 启动 ───────────────────────────────────────────── */
  function init() {
    /* 初始同步 */
    sync();

    /* 监听 html.class 变化（VueUse useDark 的写入方式） */
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        /* 只关心 html 的 class 变化，忽略我们自己写的 data-theme */
        if (mutations[i].target === html && mutations[i].attributeName === 'class') {
          setTimeout(sync, 50);
          return;
        }
      }
    }).observe(html, { attributes: true, attributeFilter: ['class'] });

    /* 监听 body 子树里 data-theme 的变化（NaiveUI n-config-provider 有时会设置） */
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.attributeName === 'data-theme' && m.target !== html) {
          setTimeout(sync, 80);
          return;
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });

    /* 轻量轮询兜底（每 800ms 检测一次背景色，捕获 CSS 变量切换但无 DOM 属性变化的情况） */
    setInterval(sync, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
