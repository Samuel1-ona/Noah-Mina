/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => {
                    return self.clients.matchAll();
                })
                .then(clients => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const coepModel = coepCredentialless ? "credentialless" : "require-corp";
        const coepHeader = coepCredentialless ? "Cross-Origin-Embedder-Policy" : "Cross-Origin-Embedder-Policy"; // Header remains the same, value changes

        event.respondWith(
            fetch(r)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", coepModel);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        // You can customize the behavior of this script through a global `coi` variable.
        const coi = {
            shouldRegister: () => true,
            shouldDeregister: () => false,
            coepCredentialless: () => false,
            doReload: () => window.location.reload(),
            quiet: false,
            ...window.coi
        };

        const n = navigator;
        if (n.serviceWorker && n.serviceWorker.controller) {
            n.serviceWorker.controller.postMessage({
                type: "coepCredentialless",
                value: coi.coepCredentialless(),
            });

            if (coi.shouldDeregister()) {
                n.serviceWorker.controller.postMessage({ type: "deregister" });
            }
        }

        if (window.crossOriginIsolated === false) {
            const scriptPath = (document.currentScript && document.currentScript.src) || window.location.href; // Fallback only works if script is inline or loaded via script tag without src? Better to rely on relative path
            // Hardcode relative path to ensure it finds the file in public/
            const swPath = './coi-serviceworker.js';

            if (n.serviceWorker) {
                n.serviceWorker.register(swPath).then(
                    (registration) => {
                        if (!coi.quiet) console.log("COI Service Worker registered");

                        registration.addEventListener("updatefound", () => {
                            if (!coi.quiet) console.log("COI Service Worker update found, reloading...");
                            coi.doReload();
                        });

                        // If already active but page not isolated, reload
                        if (registration.active && !n.serviceWorker.controller) {
                            if (!coi.quiet) console.log("COI Service Worker active, reloading page...");
                            coi.doReload();
                        }
                    },
                    (err) => {
                        if (!coi.quiet) console.error("COI Service Worker registration failed: ", err);
                    }
                );
            }
        }
    })();
}
