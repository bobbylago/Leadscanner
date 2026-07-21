# iOS Location Spoofer 🕹️

A joystick-driven **location simulator** for iOS development and testing. Drive a
virtual "you are here" pin around a real map with an on-screen thumbstick (or
WASD / arrow keys), then feed that position to iOS using Apple's own developer
tooling.

<p align="center"><em>Map + joystick → live location on the Simulator or a real device, or an exportable GPX route.</em></p>

---

## What this is (and isn't)

This is a **developer tool for testing location-aware apps** — the same job
Xcode's built-in "Simulate Location" does, but with a live joystick so you can
_walk a route_ instead of picking a static pin.

- ✅ Test your own app's geofencing, route tracking, "nearby" features, maps, etc.
- ✅ Reproduce location-dependent bugs without leaving your desk.
- ✅ Works with the iOS Simulator and with a real device in **Developer Mode**.

A regular app installed on an iPhone **cannot** override the system location for
other apps — that's an OS-level restriction. Every legitimate method feeds the
location from a connected **host (Mac)** using Apple's developer services, which
is exactly what this tool does.

> ⚠️ Spoofing your location to deceive third-party services, games, or people
> generally violates their Terms of Service and may be illegal in some contexts.
> Use this to test **software you're allowed to test**.

---

## Architecture

```
 ┌────────────────────┐     HTTP      ┌────────────────────┐   Apple dev svc   ┌──────────────┐
 │  Web joystick UI    │ ── /location ─▶│  Node bridge        │ ────────────────▶ │  iOS target   │
 │  (map + thumbstick) │               │  (bridge/server.js) │                    │  sim / device │
 └────────────────────┘               └────────────────────┘                    └──────────────┘
          │
          └── or ── "Export GPX" ──▶ drop into Xcode / pymobiledevice3 (no live connection needed)
```

There are **three ways** to get the position onto iOS, from zero-setup to fully live:

| Method | Target | Setup | Live joystick? |
| --- | --- | --- | --- |
| **GPX export** | Real device or Simulator, via Xcode | none | no — replays a recorded route |
| **Simulator bridge** | iOS Simulator | Xcode CLT | ✅ yes |
| **Device bridge** | Real iPhone/iPad | Developer Mode + `pymobiledevice3` | ✅ yes |

---

## Quick start

```bash
cd ios-location-spoofer
node bridge/server.js            # dry-run: serves the UI, logs coordinates
# open http://localhost:8765
```

Drive the joystick around. Everything except the live device output works
immediately — including **Record** and **Export GPX**.

> No npm install needed — the bridge uses only the Node standard library.

---

## Method 1 — GPX (no live connection, works everywhere)

The most reliable, fully Apple-sanctioned path for a **real device**.

1. In the UI, press **Record**, drive a route with the joystick, press it again to stop.
2. Press **Export GPX** → you get `route-*.gpx`. Each point carries a timestamp,
   so playback runs at the pace you actually drove.
3. Use it:
   - **Xcode → real device or Simulator:** add the `.gpx` to your project, run
     your app, then **Debug ▸ Simulate Location ▸ (your GPX)**. (Or set it as the
     scheme's default location.)
   - **pymobiledevice3 → real device:**
     ```bash
     ./scripts/play-gpx.sh route.gpx
     ```

A single un-recorded position also exports fine (one point = a static teleport).

## Method 2 — Live Simulator

Requires the Xcode command line tools (`xcrun simctl`).

```bash
# boot a simulator first (Xcode ▸ open a Simulator, or:)
xcrun simctl boot "iPhone 15"

node bridge/server.js --target simulator
# open http://localhost:8765 and press "Go live"
```

Now the joystick moves the Simulator's location in real time. Press **Stop /
reset device** (or Ctrl-C) to clear it.

Target a specific simulator with `--udid <UDID>` (`xcrun simctl list devices`).

## Method 3 — Live real device

Requires:

- The device connected via USB, with **Settings ▸ Privacy & Security ▸ Developer
  Mode** enabled (iOS 16+).
- [`pymobiledevice3`](https://github.com/doronz88/pymobiledevice3):
  `pip install -U pymobiledevice3`

**iOS < 17:**
```bash
node bridge/server.js --target device
```

**iOS 17+** exposes developer services only through a RemoteXPC tunnel. In one
terminal:
```bash
sudo python3 -m pymobiledevice3 remote tunneld
```
It prints an RSD `host` and `port`; pass them to the bridge:
```bash
node bridge/server.js --target device --rsd <host> <port>
```

Then open `http://localhost:8765`, press **Go live**, and drive. **Stop / reset
device** clears the simulated location; the bridge also clears it automatically
on Ctrl-C.

---

## Controls

| Control | Action |
| --- | --- |
| **Joystick** | Drag to move; push farther = faster (up to the current max speed) |
| **WASD / arrows** | Same as the joystick, from the keyboard |
| **Speed presets** | Walk / Jog / Cycle / Drive, or the fine slider (0.5–50 m/s) |
| **Search box** | Address, place name, or `lat, lon` → teleport |
| **Click map** | Teleport to that point |
| **Record** | Sample the path into a route (for GPX export) |
| **Export GPX** | Download the recorded route (or current point) |
| **Go live** | Stream the position to the configured target |
| **Stop / reset** | Clear the simulated location on the device/simulator |

---

## Bridge CLI

```
node bridge/server.js [options]

  --target <none|simulator|device>  where to push locations (default: none)
  --port <n>                        HTTP port (default: 8765)
  --udid <id>                       target device/simulator UDID
  --rsd <host> <port>               RemoteServiceDiscovery for iOS 17+ tunnel
  -h, --help
```

`GET /api/status` → `{ target, ready, message }`  ·
`POST /api/location {lat,lon}` → set  ·  `POST /api/stop` → clear.

---

## Notes & limitations

- The bridge coalesces rapid updates so a fast joystick never spawns a backlog of
  processes — only the newest coordinate is applied once the previous one lands.
- `pymobiledevice3` per-update latency is higher than the Simulator's; for buttery
  playback on a real device, prefer the **GPX** method.
- Map tiles come from OpenStreetMap; the joystick, coordinate readout, recording,
  and GPX export all keep working offline (only the visible map needs tiles).
- Requires macOS + Xcode for the Simulator path; the device path needs macOS,
  Linux, or Windows with `pymobiledevice3`.

## License

MIT — for legitimate development and testing.
