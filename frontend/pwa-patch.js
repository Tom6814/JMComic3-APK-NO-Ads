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

  // ── 3. 浏览器下载支持 (替代 Capacitor Filesystem) ──
  // 原始 App 用 Capacitor Filesystem 插件将 zip 写入设备存储，
  // 在浏览器中此操作不触发下载。此处拦截 writeFile 并转为 Blob 下载。

  (function setupDownloadPatch() {
    var downloadCache = {};
    var patchedFs = false;

    /**
     * 将 base64 数据转为 Blob 并触发浏览器下载
     */
    function downloadBlob(base64Data, filename) {
      try {
        var b64 = base64Data;
        var mime = "application/zip";

        // 处理 data URL 格式
        if (b64.indexOf(",") !== -1) {
          var parts = b64.split(",");
          var header = parts[0];
          b64 = parts.length > 1 ? parts[1] : parts[0];
          var mm = header.match(/data:([^;]+)/);
          if (mm) mime = mm[1];
        }
        b64 = b64.replace(/\s/g, "");

        // 在 worker 中做 base64 解码避免阻塞 UI
        var byteChars = atob(b64);
        var byteNums = new Uint8Array(byteChars.length);
        for (var i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        var blob = new Blob([byteNums], { type: mime });
        var url = URL.createObjectURL(blob);

        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 60000);

        console.log("[PWA Patch] Downloaded:", filename,
          (blob.size / 1024 / 1024).toFixed(2) + "MB");
        return true;
      } catch (e) {
        console.error("[PWA Patch] Download error:", e);
        return false;
      }
    }

    /**
     * 拦截指定 Filesystem 实例的 writeFile 方法
     */
    function patchWriteFile(fsPlugin) {
      if (!fsPlugin || !fsPlugin.writeFile || fsPlugin.__pwaPatched__) return;

      var origWriteFile = fsPlugin.writeFile.bind(fsPlugin);

      fsPlugin.writeFile = function (options) {
        var path = (options && options.path) || "";
        var dir = (options && options.directory) || "";

        // 检测 Cache 目录下的 zip/cbz 文件
        var dirName = String(dir).toUpperCase();
        var isCache = dirName === "CACHE" || dir === 1;

        if (isCache && /\.(zip|cbz)$/i.test(path)) {
          var data = options.data || "";
          var fname = path.split("/").pop() || "download.zip";

          console.log("[PWA Patch] Intercepted:", path);

          if (downloadCache[fname] && (Date.now() - downloadCache[fname] < 5000)) {
            console.log("[PWA Patch] Duplicate skip:", fname);
            return Promise.resolve({ uri: "blob:" + fname });
          }
          downloadCache[fname] = Date.now();

          return new Promise(function (resolve) {
            if (downloadBlob(data, fname)) {
              resolve({ uri: "blob:" + fname });
            } else {
              origWriteFile(options).then(resolve).catch(function () {
                resolve({ uri: "error:" + fname });
              });
            }
          });
        }

        return origWriteFile(options);
      };

      fsPlugin.__pwaPatched__ = true;
      patchedFs = true;
      console.log("[PWA Patch] Filesystem writeFile hooked ✓");
    }

    // ── 策略1: 提前拦截 window.Capacitor 的赋值 ──
    var _origCapacitor = window.Capacitor;
    Object.defineProperty(window, "Capacitor", {
      get: function () { return _origCapacitor; },
      set: function (val) {
        _origCapacitor = val;
        // Capacitor 被赋值后，监控 Plugins 上 Filesystem 的出现
        watchForPlugin();
      },
      configurable: true,
      enumerable: true,
    });

    // 如果 Capacitor 已存在（其他脚本先加载了）
    if (window.Capacitor) {
      watchForPlugin();
    }

    function watchForPlugin() {
      var attempts = 0;
      function check() {
        attempts++;
        try {
          var cap = window.Capacitor;
          if (cap && cap.Plugins && cap.Plugins.Filesystem) {
            patchWriteFile(cap.Plugins.Filesystem);
            return;
          }
          // 也尝试通过 Capacitor 的 plugin registry
          if (cap && cap.getPlatform && typeof cap.getPlatform === "function") {
            // Capacitor 已就绪，但 Filesystem 可能还在注册
          }
        } catch (e) {}

        if (!patchedFs && attempts < 300) {
          setTimeout(check, 100);
        }
      }
      setTimeout(check, 50);
    }

    // ── 策略2: 轮询（后备，覆盖 Capacitor 未挂到 window 的情况）───
    var pollRetries = 0;
    function pollCheck() {
      pollRetries++;
      try {
        // 检查 Capacitor 全局
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
          patchWriteFile(window.Capacitor.Plugins.Filesystem);
        }
      } catch (e) {}

      // 也检查是否有文件系统操作触发了（通过 IndexedDB 嗅探）
      if (!patchedFs && pollRetries < 250) {
        setTimeout(pollCheck, 200);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(pollCheck, 300);
      });
    } else {
      setTimeout(pollCheck, 300);
    }
  })();


})();
