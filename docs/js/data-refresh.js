(function () {
  const LAST_REFRESH_KEY = "march_madness_last_api_refresh";
  const REFRESH_EVENT = "marchmadness:api-refresh";
  const DEFAULT_REFRESH_LABEL = "Waiting for data";
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  function readLastRefresh() {
    const raw = localStorage.getItem(LAST_REFRESH_KEY);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatLastRefresh(date) {
    const now = new Date();
    const sameYear = now.getFullYear() === date.getFullYear();
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function renderLastRefresh() {
    const timeEl = document.getElementById("nav-last-refreshed-at");
    if (!timeEl) return;

    const lastRefresh = readLastRefresh();
    if (!lastRefresh) {
      timeEl.textContent = DEFAULT_REFRESH_LABEL;
      timeEl.removeAttribute("datetime");
      return;
    }

    timeEl.textContent = formatLastRefresh(lastRefresh);
    timeEl.dateTime = lastRefresh.toISOString();
  }

  function markApiDataRefresh(date = new Date()) {
    const normalized = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(normalized.getTime())) return;
    localStorage.setItem(LAST_REFRESH_KEY, normalized.toISOString());
    renderLastRefresh();
    window.dispatchEvent(
      new CustomEvent(REFRESH_EVENT, {
        detail: { refreshedAt: normalized.toISOString() },
      }),
    );
  }

  function startApiAutoRefresh(loadFn, options = {}) {
    const intervalMs = options.intervalMs ?? REFRESH_INTERVAL_MS;
    let refreshInFlight = false;

    async function refresh() {
      if (refreshInFlight) return false;
      refreshInFlight = true;

      try {
        await loadFn();
        markApiDataRefresh();
        return true;
      } finally {
        refreshInFlight = false;
      }
    }

    const intervalId = window.setInterval(() => {
      refresh().catch((error) => {
        console.error("Automatic API refresh failed:", error);
      });
    }, intervalMs);

    return {
      refresh,
      stop() {
        window.clearInterval(intervalId);
      },
    };
  }

  function initializeRefreshDisplay() {
    renderLastRefresh();
    if (window.includeReady && typeof window.includeReady.then === "function") {
      window.includeReady.then(renderLastRefresh);
    }
  }

  window.API_REFRESH_INTERVAL_MS = REFRESH_INTERVAL_MS;
  window.markApiDataRefresh = markApiDataRefresh;
  window.startApiAutoRefresh = startApiAutoRefresh;

  window.addEventListener("storage", (event) => {
    if (event.key === LAST_REFRESH_KEY) renderLastRefresh();
  });
  window.addEventListener(REFRESH_EVENT, renderLastRefresh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRefreshDisplay, {
      once: true,
    });
  } else {
    initializeRefreshDisplay();
  }
})();