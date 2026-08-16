Socket.IO deployment notes
==========================

Why this matters
-----------------
The TVK backend (`TVKSSBE`) supports Socket.IO for realtime updates. Vercel serverless functions cannot host long-lived WebSocket/Socket.IO connections — you must deploy the backend as a long-running Node process or run a separate Socket.IO host.

Recommended approaches
----------------------
- Deploy `TVKSSBE` as a long-running Node server (Render, Railway, DigitalOcean App Platform, EC2, Docker on any VPS). This allows HTTP + Socket.IO to run from the same host.
- Alternatively, deploy a dedicated Socket.IO server (same codebase or a small adapter) and point frontends to that host using the `SOCKET_URL` compile-time flag.

Build & deploy checklist
------------------------
1. Build and run the backend as a persistent server (example using the repo):

```bash
# build the compiled JS
cd TVKSSBE
npm install
npm run build
# run on the host (example)
PORT=5001 MONGODB_URI="mongodb+srv://..." node dist/server.js
```

2. If you deploy the backend to a domain (e.g. `https://api.example.com`) and want sockets on the same host, ensure `CORS_ORIGIN` includes the frontend origins and the server is reachable over TLS.

3. For frontends (Flutter apps), specify compile-time flags so the apps use the production API and socket hosts. Examples:

```bash
# Android/iOS release APK (Admin / User apps)
flutter build apk --release --dart-define=API_URL=https://api.example.com/api/v1 --dart-define=SOCKET_URL=https://api.example.com

# Web build
flutter build web --dart-define=API_URL=https://api.example.com/api/v1 --dart-define=SOCKET_URL=https://api.example.com
```

Notes about local/LAN debugging
-------------------------------
- The backend ships with a default `LAN_IP` in `TVKSSBE/.env` — set `LAN_IP` to the host IP reachable from your phone on the same WiFi (e.g. `192.168.1.16`).
- The mobile apps probe a short list of known LAN IPs to find your local backend during development. If your machine uses a different local IP, either add it to the app `fallbackLanHosts` in `lib/config/api_config.dart` or set `API_URL` at build time.

4. If you host the frontend on Vercel/Netlify and the backend is on another host, make sure `CORS_ORIGIN` in `TVKSSBE` (environment variable) lists your deployed frontend URL(s).

Notes and troubleshooting
------------------------
- If you still see `ApiConfig.socketsEnabled` false in builds, ensure `SOCKET_URL` was passed; the apps now enable sockets when `SOCKET_URL` is set at compile time.
- For secure WebSocket (wss) on custom domains, serve Socket.IO over HTTPS and use `https://` origin for the `SOCKET_URL` (the client will upgrade to `wss` automatically).
- If you prefer a separate socket host, point `SOCKET_URL` to it and keep `API_URL` pointing to the REST API host.

Security
--------
- Socket connections are authenticated using the same JWT tokens as the API. Keep `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` consistent across services.
- Ensure CORS and origin checks are correctly configured in `TVKSSBE/src/config/env.ts` (`CORS_ORIGIN`).

If you want, I can add a small Docker Compose example to run `TVKSSBE` + MongoDB + reverse proxy for TLS. Say the word and I'll scaffold it.
