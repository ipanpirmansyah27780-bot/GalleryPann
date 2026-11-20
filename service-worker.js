const { cache } = require("react");

const CACHE_NAME = "gallerypann-v1";

const FILES_TO_CACHE = [
    "/",
    "/index.html",
    "/stlye.css",
    "/script.js",
    "/manifest.json"
];

self.addEventListener("install", (Event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );

    self.skipwaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

