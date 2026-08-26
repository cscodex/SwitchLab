# Switch Lab

Interactive Ethernet switch simulator. Frames travel the wire, the CAM / MAC address table learns source addresses, and the switch floods or unicasts based on whether the destination is known.

## What it shows

1. A frame arrives. The switch records the **source MAC** on that port.
2. It looks up the **destination**.
3. **Unknown or broadcast** → flood every other port. Extra hosts drop the copy.
4. **Known** → unicast to one port.

Play the guided lesson, send presets (`PC-A → PC-B`, reply, silent host, broadcast), or click two computers yourself.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically port 8080).

## Stack

React 19, TanStack Start, Tailwind v4, Zustand.
