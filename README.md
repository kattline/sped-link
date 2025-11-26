SPED-Link PWA — Quick Deploy

1) Files:
   - index.html
   - app.js
   - styles.css
   - sw.js
   - manifest.json
   - vercel.json
   - icons/*

2) Firebase:
   - Create Firebase project (Realtime Database).
   - Copy firebaseConfig into app.js.
   - In Realtime DB rules (for testing), set:
     {
       "rules": {
         "logs": { ".read": true, ".write": true }
       }
     }
   - (Tighten rules for production with auth)

3) Deploy:
   Option A (recommended): Deploy all files at project root on Vercel (connect Git repo or upload). Vercel will serve index.html.
   Option B: Use any static host (Netlify, GitHub Pages). Ensure service worker and manifest are served from root.

4) Verify:
   - Open site in Chrome (desktop or Android).
   - Click the log buttons offline; reconnect — check Firebase DB receives entries.
   - Install prompt: if supported, you'll see the banner (or browser will show native install option).

5) Notes:
   - iOS has limited PWA support; manual Add to Home Screen needed.
   - For production, add Firebase Authentication and secure DB rules.
   - For push notifications, add Firebase Cloud Messaging + service worker push subscription (requires VAPID keys).
