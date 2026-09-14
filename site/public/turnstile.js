// Shared Turnstile client helper for hosted demos.
//
// Site keys are public by Cloudflare Turnstile design (they're embedded in
// every widget's HTML), so the key is hardcoded here rather than fetched at
// runtime — the deployment doesn't need a separate config endpoint to hand
// it out. The corresponding TURNSTILE_SECRET_KEY lives only in the Vercel
// project env and is used server-side by each demo's own route handler.
//
// A shared /api/turnstile/config endpoint has been attempted twice before
// (see HOSTING.md) and failed to deploy correctly on Vercel Services both
// times. Don't reintroduce one without a way to actually verify the deploy
// first — the third attempt broke routing for the two already-working demos
// on preview and was reverted.
//
// Usage from any demo's HTML:
//   <div id="turnstile"></div>
//   <script src="/turnstile.js"></script>
//   <script>
//     window.addEventListener('load', async () => {
//       window.__ts = await SpeechifyTurnstile.render('#turnstile', {
//         onToken: () => enableSubmit(),    // token in hand — allow submits
//         onExpired: () => disableSubmit(), // re-solving; onToken re-enables
//         onError: () => enableSubmit(),    // widget can't verify: fail open
//       });                                 // client-side, server still 403s
//       if (!window.__ts.enabled) enableSubmit(); // no site key: fail open
//     });
//   </script>
//
// Keep gated submit buttons disabled until onToken fires (or a fail-open
// case above applies) — don't let a request race the first solve.
//
// When submitting a gated request:
//   const token = await window.__ts.getToken();
//   const headers = token ? { 'x-turnstile-token': token } : {};
//   const r = await fetch('/api/whatever', { method: 'POST', headers, body });
//   window.__ts.reset(); // token is single-use; disable submits until onToken
//
// reset() forces the widget to solve again immediately (explicit
// execution: "execute" + .execute() call) instead of hoping Cloudflare's
// default post-reset auto-refire happens before the next getToken() call
// times out — that gap was making every action after the first on a page
// fail without a reload.

(function () {
  const NS = (window.SpeechifyTurnstile = window.SpeechifyTurnstile || {});
  const SITE_KEY = "0x4AAAAAAD7QYbrMFju3EnWY";

  NS.render = async function render(target, options) {
    options = options || {};
    if (!SITE_KEY) {
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
      sitekey: SITE_KEY,
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
        // Tokens expire after ~5 minutes and execution: "execute" never
        // re-fires on its own — re-solve now so pages that gate their
        // submit buttons on onToken re-enable without a reload.
        window.turnstile.reset(widgetId);
        window.turnstile.execute(widgetId);
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
