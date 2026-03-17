/**
 * Jumping 主题同步 v5
 *
 * Xboard 切换明暗的实际行为（实测确认）：
 *   暗色：html.classList 包含 'dark'
 *   亮色：html.classList 移除 'dark'，不加任何其他 class
 *
 * 所以判断逻辑极简：有 dark class → 暗色，否则 → 亮色
 * jumping.css 同步加了 html:not(.dark) 选择器覆盖亮色变量。
 */
(function () {
  var html = document.documentElement;

  function isDark() {
    return html.classList.contains('dark');
  }

  function applyTheme() {
    html.setAttribute('data-theme', isDark() ? 'dark' : 'light');
  }

  /* 监听 html class 变化（Xboard 切换时唯一的信号） */
  new MutationObserver(function () {
    applyTheme();
  }).observe(html, { attributes: true, attributeFilter: ['class'] });

  /* 初始应用 */
  applyTheme();
})();
