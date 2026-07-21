#!/usr/bin/env bash
#
# Play a recorded GPX route onto a connected iPhone using pymobiledevice3.
# The <time> stamps written by the joystick recorder make it play back at the
# real pace you drove.
#
# Requires: Developer Mode enabled on the device, and pymobiledevice3 installed
#   ( pip install -U pymobiledevice3 ).
#
# iOS 17+ needs a RemoteXPC tunnel running in another terminal:
#   sudo python3 -m pymobiledevice3 remote tunneld
# then pass the RSD host/port this script prints guidance for, or let the
# tunneld auto-discovery handle it.
#
# Usage:
#   ./play-gpx.sh route.gpx
#
set -euo pipefail

GPX="${1:-}"
if [[ -z "$GPX" || ! -f "$GPX" ]]; then
  echo "Usage: $0 <route.gpx>" >&2
  exit 1
fi

if ! command -v pymobiledevice3 >/dev/null 2>&1; then
  echo "pymobiledevice3 not found. Install with: pip install -U pymobiledevice3" >&2
  exit 1
fi

echo "Playing $GPX onto the connected device…"
echo "(Ctrl-C to stop; run 'pymobiledevice3 developer dvt simulate-location clear' to reset.)"
pymobiledevice3 developer dvt simulate-location play "$GPX"
