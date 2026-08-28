# @certilayer/web

**Passive behavioral biometrics for the browser — under 20KB, zero PII.**

CertiLayer's Web SDK silently observes how a real visitor types, moves the
mouse, scrolls, and navigates — then streams a compact behavioral feature
vector to your CertiLayer account so you can tell humans from bots without
a CAPTCHA, a fingerprinting library, or collecting a single byte of
personal data.

[![npm version](https://img.shields.io/npm/v/@certilayer/web.svg)](https://www.npmjs.com/package/@certilayer/web)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](#license)

---

## Why CertiLayer

- **No PII, ever.** No names, emails, or identifiers are captured — only
  behavioral patterns (typing rhythm, mouse velocity, scroll depth,
  navigation timing).
- **Passive.** No challenges, no puzzles, no friction for real users.
- **Tiny footprint.** Under 20KB, pure DOM/browser APIs, no runtime
  dependencies (`tslib` only).
- **Framework-agnostic.** Drop in via `<script>` tag or install from npm —
  works the same either way.

---

## Installation

### npm

```bash
npm install @certilayer/web
```

```ts
import { init } from '@certilayer/web'

init({ apiKey: 'certilayer_live_pk_xxx' })
```

### Script tag

```html
<script src="https://unpkg.com/@certilayer/web/dist/certilayer.min.js"></script>
<script>
  CertiLayer.init({ apiKey: 'certilayer_live_pk_xxx' })
</script>
```

The SDK auto-starts capture on `init()` — there's no separate call needed
to begin collecting signals.

---

## ⚠️ Public key only — never your secret key

`init()` must only ever receive your **public** key
(`certilayer_live_pk_...` or `certilayer_test_pk_...`). This SDK runs in
the visitor's browser, and anyone can view-source it — your secret key
(`certilayer_live_sk_...`) is for server-side use only (webhooks,
server-to-server calls) and must never be embedded in frontend code.

The SDK enforces this at runtime: calling `init()` with a key that starts
with `certilayer_live_sk_` throws immediately instead of silently leaking
the key to the browser.

---

## Configuration

```ts
interface CertiLayerConfig {
  apiKey: string          // required — your public key
  endpoint?: string        // default: 'https://ingest.certilayer.net'
  flushInterval?: number   // default: 5000 (ms between automatic batch sends)
  batchSize?: number       // default: 50 (max signals per batch)
  debug?: boolean          // default: false — enables console logging
}
```

| Option          | Default                          | Notes                                                      |
| --------------- | --------------------------------- | ------------------------------------------------------------ |
| `apiKey`        | —                                  | Required. Must start with `certilayer_`.                     |
| `endpoint`      | `https://ingest.certilayer.net`   | Override only for self-hosted or on-prem gateways.            |
| `flushInterval` | `5000`                             | How often buffered signals are sent, in milliseconds.        |
| `batchSize`     | `50`                                | Signals are also flushed early if the buffer fills up.       |
| `debug`         | `false`                            | Logs session lifecycle events to the console.                 |

---

## API reference

### `init(config): CertiLayerSDK`

Initializes the SDK, generates or resumes the session ID, and
**auto-starts** capture. Returns an SDK instance.

```ts
const cl = init({ apiKey: 'certilayer_live_pk_xxx' })
```

### `sdk.start(): void`

Manually (re)starts capture if it isn't already running. Not usually
needed — `init()` already calls this.

### `sdk.stop(): Promise<void>`

Stops all capture listeners, flushes any remaining buffered signals, and
removes unload listeners.

```ts
await cl.stop()
```

### `sdk.flush(): Promise<void>`

Forces an immediate send of whatever signals are currently buffered,
without waiting for the next `flushInterval` tick.

### `sdk.getSessionId(): string`

Returns the current session ID (persisted in `sessionStorage` across page
loads within the same tab/session).

---

## Trust badge

An optional "Secured by CertiLayer" badge you can drop onto any page to
show visitors their session is protected.

```ts
import { init, showBadge, hideBadge } from '@certilayer/web'

init({ apiKey: 'certilayer_live_pk_xxx' })
showBadge({ position: 'bottom-right', theme: 'dark' })

// later, if needed:
hideBadge()
```

```ts
interface BadgeOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' // default: 'bottom-right'
  theme?: 'dark' | 'light'    // default: 'dark'
  showPulse?: boolean          // default: true — animated "live" indicator
  zIndex?: number              // default: 999999
}
```

The badge is pure DOM (~800 bytes), has no external dependencies, and
opens `certilayer.net` in a new tab when clicked.

---

## What gets captured

Four signal types, all behavioral — never content:

| Signal       | What's recorded                                                      |
| ------------ | ---------------------------------------------------------------------- |
| `keyboard`   | Inter-key interval and dwell time per keystroke — **not** which keys were pressed as content |
| `mouse`      | Position, velocity, and click duration                                 |
| `scroll`     | Delta, velocity, and page-depth ratio                                  |
| `navigation` | SPA route transitions and time spent per route                        |

Signals are batched, converted into a 34-dimension feature vector
client-side, and sent to your CertiLayer ingestion endpoint — raw signals
are retained only for audit purposes.

---

## Browser support

Targets modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses
`sessionStorage`, `fetch`/`sendBeacon`, and standard DOM event listeners
— no polyfills are bundled. If `sessionStorage` is unavailable (e.g.
strict incognito settings), the SDK falls back to an in-memory session ID
for that page load.

---

## License

© CertiLayer. All rights reserved.

## Support

- Docs: [certilayer.net/docs](https://certilayer.net/docs)
- Issues: please contact [contact@certilayer.net](mailto:contact@certilayer.net)

# certilayer-web-sdk
