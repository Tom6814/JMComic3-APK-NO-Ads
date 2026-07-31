/**
 * JMComic3 PWA Patch — 解除非 App 环境下的阻断逻辑
 *
 * 原始 APK 内有两个阻断：
 *   1. Exit App 检查 — 非 Cordova/Capacitor/Standalone 环境弹出提示并跳转
 *   2. DevTools 检测 — 检测到开发者工具后封锁页面
 *
 * 此补丁在 main.js 加载之前注入，从源头消除这些限制。
 */
(function () {
  "use strict";

  // ── 1. 伪装 PWA Standalone 模式 ──
  // 原始逻辑：检查 window.matchMedia("(display-mode: standalone)") 和 navigator.standalone
  // 让这两个检查始终返回 true，绕过 Exit App 阻断

  const origMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = function (query) {
    if (query === "(display-mode: standalone)") {
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () { return true; },
      };
    }
    return origMatchMedia(query);
  };

  // iOS standalone 标记
  try {
    Object.defineProperty(navigator, "standalone", {
      get: function () { return true; },
      configurable: true,
    });
  } catch (e) {
    // 某些浏览器不允许 redefine，忽略
  }

  // ── 2. 禁用 DevTools 检测 ──
  // 原始逻辑通过对比 performance.now() 差异来检测 DevTools
  // 这里截获 alert 中的 "devtools_blocked" 消息，并阻止跳转

  const origAlert = window.alert.bind(window);
  let patchedAlert = false;

  window.alert = function (msg) {
    if (typeof msg === "string") {
      // 静默拦截 Exit App / DevTools 阻断
      if (
        msg.includes("App") && (msg.includes("加入主畫面") || msg.includes("加入主屏幕"))
      ) {
        console.log("[PWA Patch] 已拦截 Exit App 阻断");
        return;
      }
      if (
        msg.includes("封鎖") || msg.includes("封鎖") ||
        msg.includes("开发") || msg.includes("開發")
      ) {
        console.log("[PWA Patch] 已拦截 DevTools 阻断");
        return;
      }
    }
    return origAlert(msg);
  };

  // 拦截 window.location 重定向
  var _origReplace = window.location.replace.bind(window.location);
  var _origHrefDescriptor = Object.getOwnPropertyDescriptor(
    window.Location.prototype,
    "href"
  );

  window.location.replace = function (url) {
    if (
      url.includes("comicloveu.com") ||
      url.includes("18comic")
    ) {
      console.log("[PWA Patch] 已拦截 location.replace:", url);
      return;
    }
    return _origReplace(url);
  };

  // 拦截 location.href 赋值
  try {
    Object.defineProperty(window.location, "href", {
      get: function () {
        return _origHrefDescriptor.get.call(window.location);
      },
      set: function (url) {
        if (
          typeof url === "string" &&
          (url.includes("comicloveu.com") || url.includes("18comic"))
        ) {
          console.log("[PWA Patch] 已拦截 location.href:", url);
          return;
        }
        _origHrefDescriptor.set.call(window.location, url);
      },
      configurable: true,
    });
  } catch (e) {
    // location.href 在某些环境下不可配置
  }

  console.log("[PWA Patch] 已加载 — Exit App / DevTools 阻断已解除");
})();
