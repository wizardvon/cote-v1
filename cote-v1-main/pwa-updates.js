const SERVICE_WORKER_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";
const UPDATE_RELOAD_KEY = "cote-sw-update-reload-pending";

function clearReloadGuard() {
  if (sessionStorage.getItem(UPDATE_RELOAD_KEY)) {
    sessionStorage.removeItem(UPDATE_RELOAD_KEY);
  }
}

function reloadOnceForUpdate() {
  if (sessionStorage.getItem(UPDATE_RELOAD_KEY)) return;

  sessionStorage.setItem(UPDATE_RELOAD_KEY, "1");
  window.location.reload();
}

export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    clearReloadGuard();
    let shouldReloadOnControllerChange = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!shouldReloadOnControllerChange) {
        shouldReloadOnControllerChange = true;
        return;
      }

      reloadOnceForUpdate();
    });

    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        updateViaCache: "none"
      })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        registration.update().catch((error) => {
          console.error("Service worker update check failed:", error);
        });
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
