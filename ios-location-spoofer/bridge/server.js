#!/usr/bin/env node
/*
 * iOS Location Spoofer — host bridge.
 *
 * Serves the web joystick UI and pushes the streamed coordinates to a real
 * location target using Apple's own developer tooling:
 *
 *   --target simulator   xcrun simctl location <udid|booted> set <lat>,<lon>
 *   --target device      pymobiledevice3 developer dvt simulate-location set -- <lat> <lon>
 *   --target none        dry-run: just logs (default, for testing the UI)
 *
 * Zero npm dependencies — Node standard library only.
 *
 * Usage:
 *   node bridge/server.js                       # dry-run on :8765
 *   node bridge/server.js --target simulator    # drive the booted Simulator
 *   node bridge/server.js --target device       # drive a connected iPhone
 *   node bridge/server.js --target device --udid <UDID> --rsd <host> <port>
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// ── CLI args ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { target: "none", port: 8765, udid: null, rsd: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") out.target = argv[++i];
    else if (a === "--port") out.port = parseInt(argv[++i], 10);
    else if (a === "--udid") out.udid = argv[++i];
    else if (a === "--rsd") out.rsd = [argv[++i], argv[++i]]; // [host, port] for iOS 17+ tunnel
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  if (!["none", "simulator", "device"].includes(out.target)) {
    console.error(`Unknown --target "${out.target}". Use none | simulator | device.`);
    process.exit(1);
  }
  return out;
}

function printHelp() {
  console.log(`iOS Location Spoofer bridge

  node bridge/server.js [options]

  --target <none|simulator|device>  where to push locations (default: none)
  --port <n>                        HTTP port (default: 8765)
  --udid <id>                       target device/simulator UDID (optional)
  --rsd <host> <port>               RemoteServiceDiscovery for iOS 17+ device tunnel
  -h, --help                        show this help
`);
}

const args = parseArgs(process.argv.slice(2));
const WEB_DIR = path.join(__dirname, "..", "web");

// ── Location backend ────────────────────────────────────────────────────────
// A single in-flight child process at a time; the newest requested coordinate
// is coalesced so a fast joystick never queues up hundreds of processes.
let inflight = false;
let pending = null; // { lat, lon } or "stop"
let backendReady = args.target === "none";
let backendMessage =
  args.target === "none" ? "dry-run (no device)" : "not yet verified";

function buildSetCommand(lat, lon) {
  const udid = args.udid || "booted";
  if (args.target === "simulator") {
    return ["xcrun", ["simctl", "location", udid, "set", `${lat},${lon}`]];
  }
  // device (pymobiledevice3)
  const cmd = ["developer", "dvt", "simulate-location", "set"];
  if (args.rsd) cmd.unshift(...["--rsd", args.rsd[0], args.rsd[1]]);
  cmd.push("--", String(lat), String(lon));
  return ["pymobiledevice3", cmd];
}

function buildClearCommand() {
  const udid = args.udid || "booted";
  if (args.target === "simulator") {
    return ["xcrun", ["simctl", "location", udid, "clear"]];
  }
  const cmd = ["developer", "dvt", "simulate-location", "clear"];
  if (args.rsd) cmd.unshift(...["--rsd", args.rsd[0], args.rsd[1]]);
  return ["pymobiledevice3", cmd];
}

function runBackend(task) {
  if (args.target === "none") {
    if (task !== "stop") {
      process.stdout.write(
        `\r[dry-run] ${task.lat.toFixed(6)}, ${task.lon.toFixed(6)}          `
      );
    } else {
      process.stdout.write("\n[dry-run] stop / clear\n");
    }
    return;
  }

  if (inflight) {
    pending = task; // coalesce — keep only the latest
    return;
  }
  inflight = true;

  const [bin, argv] =
    task === "stop" ? buildClearCommand() : buildSetCommand(task.lat, task.lon);

  const child = spawn(bin, argv, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));

  child.on("error", (err) => {
    inflight = false;
    backendReady = false;
    backendMessage =
      err.code === "ENOENT"
        ? `"${bin}" not found — install it and ensure it is on PATH`
        : err.message;
    console.error(`\n[backend] ${backendMessage}`);
  });

  child.on("close", (code) => {
    inflight = false;
    if (code === 0) {
      if (!backendReady) console.log(`\n[backend] ${args.target} ready`);
      backendReady = true;
      backendMessage = "ok";
    } else {
      backendReady = false;
      backendMessage = (stderr.trim().split("\n").pop() || `exit ${code}`).slice(0, 200);
      console.error(`\n[backend] failed (${code}): ${backendMessage}`);
    }
    // Flush the most recent coordinate we skipped while busy.
    if (pending) {
      const next = pending;
      pending = null;
      runBackend(next);
    }
  });
}

// ── Static file serving ─────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  // Prevent path traversal.
  const filePath = path.join(WEB_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "text/plain" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e6) req.destroy(); // guard against oversized payloads
    });
    req.on("end", () => resolve(body));
  });
}

// ── HTTP server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ target: args.target, ready: backendReady, message: backendMessage })
    );
  }

  if (url === "/api/location" && req.method === "POST") {
    const body = await readBody(req);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400);
      return res.end("Bad JSON");
    }
    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      res.writeHead(422);
      return res.end("Invalid coordinates");
    }
    runBackend({ lat, lon });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url === "/api/stop" && req.method === "POST") {
    runBackend("stop");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "GET") return serveStatic(req, res);

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(args.port, () => {
  const url = `http://localhost:${args.port}`;
  console.log("┌────────────────────────────────────────────────┐");
  console.log("│  iOS Location Spoofer — joystick bridge         │");
  console.log("└────────────────────────────────────────────────┘");
  console.log(`  Target : ${args.target}`);
  console.log(`  Open   : ${url}`);
  if (args.target === "device") {
    console.log("  Device : requires Developer Mode + pymobiledevice3");
    if (!args.rsd) console.log("           iOS 17+? start a tunnel and pass --rsd <host> <port>");
  }
  if (args.target === "simulator") {
    console.log("  Sim    : requires Xcode command line tools (xcrun simctl)");
  }
  console.log("  Ctrl-C to quit.\n");
});

// Clear the simulated location on exit so the device isn't left spoofed.
function cleanup() {
  if (args.target !== "none") {
    try {
      const [bin, argv] = buildClearCommand();
      spawn(bin, argv, { stdio: "ignore" });
    } catch {
      /* best effort */
    }
  }
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
