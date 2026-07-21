/*
 * iOS Location Spoofer — joystick controller.
 *
 * Drives a virtual "you are here" pin around a real map. The current position
 * can be:
 *   1. Recorded into a route and exported as a GPX file (drop into Xcode to
 *      simulate location on a real device, or feed to `pymobiledevice3 ...
 *      simulate-location play`).
 *   2. Streamed live to the local bridge server, which pushes it to the iOS
 *      Simulator (`xcrun simctl location`) or a connected device
 *      (`pymobiledevice3 ... simulate-location set`).
 *
 * No build step, no framework. Leaflet (loaded from CDN) is optional — every
 * feature except the visible map works without it.
 */
(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────
  const EARTH_M_PER_DEG_LAT = 111320; // metres per degree of latitude

  const SPEED_PRESETS = {
    walk: 1.4, // ~5 km/h
    jog: 3.0, // ~11 km/h
    cycle: 6.0, // ~22 km/h
    drive: 13.4, // ~48 km/h
  };

  // How often to sample the route while recording.
  const RECORD_MIN_INTERVAL_MS = 900;
  const RECORD_MIN_DISTANCE_M = 3;

  // How often to push live updates to the bridge.
  const LIVE_SEND_INTERVAL_MS = 200;

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    lat: 37.334886, // Apple Park, Cupertino — a friendly default
    lon: -122.008988,
    heading: 0,
    speedMps: 0,
    maxSpeed: SPEED_PRESETS.walk,
    moving: false,
    recording: false,
    track: [], // [{ lat, lon, t }]
    live: false,
    liveOk: null,
  };

  let vector = { x: 0, y: 0, magnitude: 0, angle: 0 };
  const keys = new Set();
  let lastRecordAt = 0;
  let lastRecordPoint = null;
  let lastLiveSentAt = 0;
  let lastFollowAt = 0;

  // ── DOM ────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const el = {
    coords: $("coords"),
    heading: $("heading"),
    speedReadout: $("speed-readout"),
    trackCount: $("track-count"),
    liveDot: $("live-dot"),
    liveLabel: $("live-label"),
    joyBase: $("joy-base"),
    joyKnob: $("joy-knob"),
    speedSlider: $("speed-slider"),
    speedValue: $("speed-value"),
    recordBtn: $("record-btn"),
    exportBtn: $("export-btn"),
    clearBtn: $("clear-btn"),
    stopBtn: $("stop-btn"),
    liveBtn: $("live-btn"),
    centerBtn: $("center-btn"),
    latInput: $("lat-input"),
    lonInput: $("lon-input"),
    gotoBtn: $("goto-btn"),
    searchInput: $("search-input"),
    searchBtn: $("search-btn"),
    toast: $("toast"),
  };

  // ── Map (optional) ─────────────────────────────────────────────────────
  let map = null;
  let marker = null;
  let accuracy = null;
  const hasLeaflet = typeof window.L !== "undefined";

  function initMap() {
    if (!hasLeaflet) {
      document.getElementById("map").classList.add("no-map");
      return;
    }
    map = L.map("map", { zoomControl: false, attributionControl: true }).setView(
      [state.lat, state.lon],
      16
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    accuracy = L.circle([state.lat, state.lon], {
      radius: 12,
      color: "#0a84ff",
      weight: 1,
      fillColor: "#0a84ff",
      fillOpacity: 0.15,
    }).addTo(map);

    const icon = L.divIcon({
      className: "loc-pin",
      html: '<div class="loc-pin-dot"></div><div class="loc-pin-arrow"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    marker = L.marker([state.lat, state.lon], { icon }).addTo(map);

    map.on("click", (e) => {
      setPosition(e.latlng.lat, e.latlng.lng, { teleport: true });
    });
  }

  function updateMarker(follow) {
    if (!marker) return;
    marker.setLatLng([state.lat, state.lon]);
    accuracy.setLatLng([state.lat, state.lon]);
    const arrow = marker.getElement()?.querySelector(".loc-pin-arrow");
    if (arrow) {
      arrow.style.opacity = state.moving ? "1" : "0";
      arrow.style.transform = `rotate(${state.heading}deg)`;
    }
    if (follow) map.setView([state.lat, state.lon], map.getZoom(), { animate: false });
  }

  // ── Position ───────────────────────────────────────────────────────────
  function setPosition(lat, lon, opts = {}) {
    state.lat = clampLat(lat);
    state.lon = wrapLon(lon);
    updateReadout();
    updateMarker(opts.center !== false && (opts.teleport || opts.center));
    if (opts.teleport) {
      recordPoint(true);
      sendLive(true);
      if (opts.center !== false && map) map.setView([state.lat, state.lon], map.getZoom());
    }
  }

  function clampLat(v) {
    return Math.max(-90, Math.min(90, v));
  }
  function wrapLon(v) {
    return ((((v + 180) % 360) + 360) % 360) - 180;
  }

  // ── Movement loop ──────────────────────────────────────────────────────
  let lastFrame = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1); // seconds, capped
    lastFrame = now;

    // Keyboard synthesizes a joystick vector when the stick is idle.
    const kv = keyboardVector();
    const v = vector.magnitude > 0 ? vector : kv;

    if (v.magnitude > 0.02) {
      state.speedMps = v.magnitude * state.maxSpeed;
      // Screen: +y is down, so north component is -y.
      const north = -v.y * state.speedMps;
      const east = v.x * state.speedMps;

      const dLat = (north * dt) / EARTH_M_PER_DEG_LAT;
      const cosLat = Math.cos((state.lat * Math.PI) / 180) || 1e-6;
      const dLon = (east * dt) / (EARTH_M_PER_DEG_LAT * cosLat);

      state.lat = clampLat(state.lat + dLat);
      state.lon = wrapLon(state.lon + dLon);
      state.heading = (Math.atan2(east, north) * 180) / Math.PI;
      state.moving = true;

      updateReadout();
      const follow = now - lastFollowAt > 60;
      if (follow) lastFollowAt = now;
      updateMarker(follow);
      recordPoint(false);
      sendLive(false);
    } else if (state.moving) {
      state.moving = false;
      state.speedMps = 0;
      updateReadout();
      updateMarker(false);
    }

    requestAnimationFrame(frame);
  }

  function keyboardVector() {
    let x = 0;
    let y = 0;
    if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
    const mag = Math.min(Math.hypot(x, y), 1);
    if (mag === 0) return { x: 0, y: 0, magnitude: 0, angle: 0 };
    const a = Math.atan2(y, x);
    return { x: Math.cos(a), y: Math.sin(a), magnitude: mag, angle: a };
  }

  // ── Readout ────────────────────────────────────────────────────────────
  function updateReadout() {
    const ns = state.lat >= 0 ? "N" : "S";
    const ew = state.lon >= 0 ? "E" : "W";
    el.coords.textContent =
      `${Math.abs(state.lat).toFixed(6)}° ${ns}, ${Math.abs(state.lon).toFixed(6)}° ${ew}`;
    el.heading.textContent = `${Math.round((state.heading + 360) % 360)}°`;
    const kmh = (state.speedMps * 3.6).toFixed(1);
    el.speedReadout.textContent = state.moving ? `${kmh} km/h` : "stationary";
    el.trackCount.textContent = String(state.track.length);
    // Keep the manual lat/lon inputs in sync unless the user is typing in them.
    if (el.latInput !== document.activeElement) el.latInput.value = state.lat.toFixed(6);
    if (el.lonInput !== document.activeElement) el.lonInput.value = state.lon.toFixed(6);
  }

  // ── Recording ──────────────────────────────────────────────────────────
  function recordPoint(force) {
    if (!state.recording) return;
    const now = Date.now();
    if (!force) {
      if (now - lastRecordAt < RECORD_MIN_INTERVAL_MS) return;
      if (lastRecordPoint) {
        const d = haversine(lastRecordPoint.lat, lastRecordPoint.lon, state.lat, state.lon);
        if (d < RECORD_MIN_DISTANCE_M) return;
      }
    }
    lastRecordAt = now;
    lastRecordPoint = { lat: state.lat, lon: state.lon };
    state.track.push({ lat: state.lat, lon: state.lon, t: now });
    el.trackCount.textContent = String(state.track.length);
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function toggleRecording() {
    state.recording = !state.recording;
    el.recordBtn.classList.toggle("recording", state.recording);
    el.recordBtn.querySelector(".label").textContent = state.recording ? "Recording…" : "Record";
    if (state.recording) {
      lastRecordAt = 0;
      lastRecordPoint = null;
      recordPoint(true); // seed with the current point
      toast("Recording route");
    } else {
      toast(`Route stopped — ${state.track.length} points`);
    }
  }

  // ── GPX export ─────────────────────────────────────────────────────────
  function buildGpx() {
    const pts = state.track.length
      ? state.track
      : [{ lat: state.lat, lon: state.lon, t: Date.now() }];
    const rows = pts
      .map(
        (p) =>
          `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">` +
          `<time>${new Date(p.t).toISOString()}</time></trkpt>`
      )
      .join("\n");
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<gpx version="1.1" creator="ios-location-spoofer" ' +
      'xmlns="http://www.topografix.com/GPX/1/1">\n' +
      "  <trk>\n    <name>Spoofed route</name>\n    <trkseg>\n" +
      rows +
      "\n    </trkseg>\n  </trk>\n</gpx>\n"
    );
  }

  function exportGpx() {
    const blob = new Blob([buildGpx()], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${state.track.length || 1} point(s) to GPX`);
  }

  function clearTrack() {
    state.track = [];
    lastRecordPoint = null;
    el.trackCount.textContent = "0";
    toast("Route cleared");
  }

  // ── Live bridge ────────────────────────────────────────────────────────
  async function refreshStatus() {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiveLabel(data.target, data.ready);
      return data;
    } catch {
      setLiveLabel(null, false);
      return null;
    }
  }

  function setLiveLabel(target, ready) {
    if (!target) {
      el.liveDot.className = "dot off";
      el.liveLabel.textContent = "bridge offline";
      return;
    }
    el.liveDot.className = ready ? "dot on" : "dot warn";
    const names = { simulator: "Simulator", device: "Device", none: "dry-run" };
    el.liveLabel.textContent = `${names[target] || target}${state.live ? " · streaming" : ""}`;
  }

  async function toggleLive() {
    if (!state.live) {
      const status = await refreshStatus();
      if (!status) {
        toast("Bridge not running — start bridge/server.js");
        return;
      }
      state.live = true;
      el.liveBtn.classList.add("active");
      el.liveBtn.querySelector(".label").textContent = "Streaming";
      sendLive(true);
      setLiveLabel(status.target, status.ready);
      toast(`Streaming to ${status.target}`);
    } else {
      state.live = false;
      el.liveBtn.classList.remove("active");
      el.liveBtn.querySelector(".label").textContent = "Go live";
      refreshStatus();
    }
  }

  function sendLive(force) {
    if (!state.live) return;
    const now = Date.now();
    if (!force && now - lastLiveSentAt < LIVE_SEND_INTERVAL_MS) return;
    lastLiveSentAt = now;
    fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: state.lat, lon: state.lon }),
    }).catch(() => {
      /* transient — the loop will retry on the next tick */
    });
  }

  async function stopSpoof() {
    if (state.live) {
      await fetch("/api/stop", { method: "POST" }).catch(() => {});
    }
    toast("Sent stop / reset to device");
  }

  // ── Geocode search (OpenStreetMap Nominatim) ───────────────────────────
  async function search() {
    const q = el.searchInput.value.trim();
    if (!q) return;
    // Allow "lat, lon" direct entry.
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
      setPosition(parseFloat(m[1]), parseFloat(m[2]), { teleport: true });
      toast("Jumped to coordinates");
      return;
    }
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (!data.length) {
        toast("No match found");
        return;
      }
      setPosition(parseFloat(data[0].lat), parseFloat(data[0].lon), { teleport: true });
      toast(data[0].display_name.split(",").slice(0, 2).join(","));
    } catch {
      toast("Search unavailable (offline?)");
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  // ── Wiring ─────────────────────────────────────────────────────────────
  function setMaxSpeed(mps, sourceBtn) {
    state.maxSpeed = mps;
    el.speedSlider.value = String(mps);
    el.speedValue.textContent = `${mps.toFixed(1)} m/s · ${(mps * 3.6).toFixed(0)} km/h`;
    document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
    if (sourceBtn) sourceBtn.classList.add("active");
  }

  function init() {
    initMap();
    updateReadout();

    new Joystick(el.joyBase, el.joyKnob, {
      onChange: (v) => {
        vector = v;
      },
      onEnd: () => {
        vector = { x: 0, y: 0, magnitude: 0, angle: 0 };
      },
    });

    // Speed presets
    document.querySelectorAll(".preset").forEach((btn) => {
      btn.addEventListener("click", () => setMaxSpeed(SPEED_PRESETS[btn.dataset.speed], btn));
    });
    el.speedSlider.addEventListener("input", () => {
      setMaxSpeed(parseFloat(el.speedSlider.value), null);
    });
    setMaxSpeed(SPEED_PRESETS.walk, document.querySelector('.preset[data-speed="walk"]'));

    // Buttons
    el.recordBtn.addEventListener("click", toggleRecording);
    el.exportBtn.addEventListener("click", exportGpx);
    el.clearBtn.addEventListener("click", clearTrack);
    el.stopBtn.addEventListener("click", stopSpoof);
    el.liveBtn.addEventListener("click", toggleLive);
    el.centerBtn.addEventListener("click", () => {
      if (map) map.setView([state.lat, state.lon], map.getZoom());
    });
    el.gotoBtn.addEventListener("click", () => {
      const lat = parseFloat(el.latInput.value);
      const lon = parseFloat(el.lonInput.value);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setPosition(lat, lon, { teleport: true });
        toast("Jumped to coordinates");
      } else {
        toast("Enter valid lat / lon");
      }
    });
    el.searchBtn.addEventListener("click", search);
    el.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") search();
    });

    // Keyboard driving — ignore when typing in a field.
    window.addEventListener("keydown", (e) => {
      if (isTyping(e.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));
    window.addEventListener("blur", () => keys.clear());

    refreshStatus();
    setInterval(refreshStatus, 5000);

    requestAnimationFrame(frame);
  }

  function isTyping(target) {
    return (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose a tiny API for debugging / tests.
  window.__spoofer = { state, buildGpx, setPosition };
})();
