import type { Ref } from "vue";

interface PwaState {
  updateAvailable: Ref<boolean>;
  applyUpdate: () => void;
}

export default defineNuxtPlugin(() => {
  const updateAvailable = ref(false);
  let waitingWorker: ServiceWorker | null = null;

  const applyUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  // Never register the SW in dev: it would cache Vite's HMR modules and serve
  // stale assets, producing a blank page (notably in the VSCode integrated browser).
  if (import.meta.client && !import.meta.dev && "serviceWorker" in navigator) {
    const promptUpdate = (worker: ServiceWorker | null) => {
      if (!worker) return;
      waitingWorker = worker;
      updateAvailable.value = true;
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(registration.waiting);
            }
          });
        });
      })
      .catch(() => {
        // Registration failures are non-fatal: the app still works without the SW.
      });

    // Reload once the new SW has taken control after SKIP_WAITING.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } else if (import.meta.client && import.meta.dev && "serviceWorker" in navigator) {
    // Clean up any SW left over from a previous dev session so it stops
    // intercepting requests and serving stale cached assets.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }

  return {
    provide: {
      pwa: { updateAvailable, applyUpdate } satisfies PwaState,
    },
  };
});
