/**
 * Jumping 默认深色：在 Vue 应用读取前设置 theme，确保首次访问为深色
 * 仅当用户尚未保存过主题偏好时生效，已有偏好则不动
 * 同时在 <html> 上打 dark class，避免 CSS 变量在 theme-sync.js 运行前闪白
 */
(function() {
  var OUR_KEY = 'jumping-theme';
  var keys = [OUR_KEY, 'theme', 'nuxt-color-mode', 'color-scheme', 'xboard-theme', 'vueuse-color-scheme', 'tablerTheme'];
  var stored = null;
  for (var i = 0; i < keys.length; i++) {
    var v = localStorage.getItem(keys[i]);
    if (v) { stored = String(v).toLowerCase(); break; }
  }
  var theme = (stored === 'light' || stored === 'light-mode') ? 'light' : 'dark';
  /* 同步写入所有 key，确保 Vue 读到正确主题 */
  localStorage.setItem(OUR_KEY, theme);
  localStorage.setItem('theme', theme);
  localStorage.setItem('tablerTheme', theme);
  localStorage.setItem('vueuse-color-scheme', theme);
  /* 立即给 <html> 加 class，CSS 变量马上生效，防止白屏闪烁 */
  var el = document.documentElement;
  if (theme === 'light') {
    el.classList.add('light'); el.classList.remove('dark');
    el.setAttribute('data-theme', 'light');
  } else {
    el.classList.add('dark'); el.classList.remove('light');
    el.setAttribute('data-theme', 'dark');
  }
})();
