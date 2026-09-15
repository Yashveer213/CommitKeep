# Commit-Keep PWA support

Commit-Keep supports the latest two stable Chrome and Edge releases on desktop, the latest two Android Chrome releases, the current and previous Safari releases on macOS, the current and previous iOS/iPadOS major releases, and the latest two Firefox releases as a responsive website. Installation UI varies by browser. Chromium uses its install prompt or menu; Safari on iPhone and iPad uses Share → Add to Home Screen; Firefox remains a supported browser even where app installation is unavailable.

Automated checks validate the manifest, icon dimensions, cache exclusions, service-worker syntax, calendar behavior, schema migration shape, and production build. Release QA must still test real Chrome, Edge, Safari, iPhone/iPad, Android, and Firefox installations, updates, safe-area layout, offline fallback, keyboard navigation, screen readers, 200% zoom, and portrait/landscape behavior.
