// Shared Turnstile client helper for hosted demos.
//
// Every demo reconciles against the shared /api/turnstile/config endpoint
// (services/turnstile-config, mounted at that path in the root vercel.json)
// before rendering: it tells the client whether the deployment actually has
// TURNSTILE_SECRET_KEY configured, so forks and local dev can skip rendering
// a widget nothing server-side will ever check. Site keys are public by
// Cloudflare Turnstile design (embedded in every rendered widget), so a
// hardcoded key here is still a safe fallback if that endpoint is ever
// unreachable — fail open to "enabled", not to "skip the widget".
//
// Usage from any demo's HTML:
//   <div id="turnstile"></div>
//   <script src="/turnstile.js"></script>
//   <script>
//     window.addEventListener('load', async () => {
//       window.__ts = await SpeechifyTurnstile.render('#turnstile');
//     });
//   </script>
//
// When submitting a gated request:
//   const token = await window.__ts.getToken();
//   const headers = token ? { 'x-turnstile-token': token } : {};
//   const r = await fetch('/api/whatever', { method: 'POST', headers, body });
//   window.__ts.reset();
//
// reset() forces the widget to solve again immediately (explicit
// execution: "execute" + .execute() call) instead of hoping Cloudflare's
// default post-reset auto-refire happens before the next getToken() call
// times out — that gap was making every action after the first on a page
// fail without a reload.

(function () {
  const NS = (window.SpeechifyTurnstile = window.SpeechifyTurnstile || {});
  const SITE_KEY = "0x4AAAAAAD7QYbrMFju3EnWY";

  let configPromise = null;
  NS.config = function config() {
    if (!configPromise) {
      configPromise = fetch("/api/turnstile/config", { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : { enabled: true, siteKey: SITE_KEY }))
        .catch(() => ({ enabled: true, siteKey: SITE_KEY }));
    }
    return configPromise;
  };

  NS.render = async function render(target, options) {
    options = options || {};
    const cfg = await NS.config();
    if (!cfg.enabled) {
      return {
        enabled: false,
        getToken: function () {
          return Promise.resolve(null);
        },
        reset: function () {},
      };
    }
    const siteKey = cfg.siteKey || SITE_KEY;

    await loadTurnstileScript();
    while (!window.turnstile) await sleep(20);

    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) throw new Error("SpeechifyTurnstile.render: target not found");

    let currentToken = null;
    const widgetId = window.turnstile.render(el, {
      sitekey: siteKey,
      execution: "execute",
      callback: function (token) {
        currentToken = token;
        if (options.onToken) options.onToken(token);
      },
      "error-callback": function (err) {
        currentToken = null;
        if (options.onError) options.onError(err);
      },
      "expired-callback": function () {
        currentToken = null;
        if (options.onExpired) options.onExpired();
      },
      ...(options.turnstile || {}),
    });
    // execution: "execute" never auto-runs — kick off the first solve now.
    window.turnstile.execute(widgetId);

    return {
      enabled: true,
      widgetId,
      getToken: async function getToken(opts) {
        const timeout = (opts && opts.timeout) || 15000;
        if (currentToken) return currentToken;
        const started = Date.now();
        while (!currentToken && Date.now() - started < timeout) {
          await sleep(50);
        }
        return currentToken;
      },
      reset: function () {
        currentToken = null;
        window.turnstile.reset(widgetId);
        // Don't wait on an implicit auto-refire: force the next solve to
        // start right away so the following getToken() doesn't just time out.
        window.turnstile.execute(widgetId);
      },
    };
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let scriptPromise = null;
  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("failed to load Cloudflare Turnstile script"));
      };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }
})();
