// Shared Turnstile client helper for hosted demos.
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
// When the deployment doesn't have Turnstile env vars set (local dev, forks),
// render() returns { enabled: false, getToken: () => null } and callers just
// send an empty token — the verify endpoint fail-opens to match.

(function () {
  const NS = (window.SpeechifyTurnstile = window.SpeechifyTurnstile || {});

  let configPromise = null;
  NS.config = function config() {
    if (!configPromise) {
      configPromise = fetch("/api/turnstile/config", { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : { enabled: false }))
        .catch(() => ({ enabled: false }));
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

    await loadTurnstileScript();
    while (!window.turnstile) await sleep(20);

    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) throw new Error("SpeechifyTurnstile.render: target not found");

    let currentToken = null;
    const widgetId = window.turnstile.render(el, {
      sitekey: cfg.siteKey,
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
      },
    };
  };

  NS.verify = async function verify(token) {
    const r = await fetch("/api/turnstile/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!r.ok) return { verified: false };
    return await r.json();
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
