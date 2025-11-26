SPED-Link PWA - Quick Setup

1) Web (static)
- Place web/* files on a static server (e.g., serve with `npx http-server web` or GitHub Pages).

2) Server (optional demo)
- cd server
- npm install
- node server.js
- Server runs at http://localhost:3000

3) Firebase (optional - recommended)
- Create Firebase project.
- Enable Realtime Database.
- Replace firebaseConfig in web/app.js with your project's config.
- Set rules (see README)
- If using Firebase, the client automatically syncs to Firebase when online.

4) Install & test
- Open the site in Chrome (desktop or Android) -> you should see install banner when `beforeinstallprompt` is available.
- Use Teacher buttons offline; they queue locally and sync when online.
- Parent view shows realtime updates from Firebase.

Notes:
- iOS Safari requires manual "Add to Home Screen".
- For push notifications, implement FCM + VAPID + Service Worker push subscription.
