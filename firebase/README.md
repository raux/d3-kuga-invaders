# Firebase leaderboard setup

Kuga Invaders uses Firebase Anonymous Authentication and Cloud Firestore for its public Top 5 leaderboard.

## 1. Create Firebase services

1. Create or select a Firebase project.
2. Add a Web app in **Project settings > Your apps**.
3. Enable **Authentication > Sign-in method > Anonymous**.
4. In **Authentication > Settings > Authorized domains**, add `raux.github.io`.
5. Create a Cloud Firestore database in production mode and record its database ID. This project uses `kugaleaderboard`.
6. Select that database, open **Firestore Database > Rules**, paste [`firestore.rules`](firestore.rules), and publish the rules.

The leaderboard query orders one field (`bestScore`) and does not require a custom composite index.

## 2. Configure local development

Copy the example environment file and enter the Firebase Web app values:

```bash
cp .env.example .env.local
npm run dev
```

Vite only exposes variables prefixed with `VITE_`. Firebase Web API keys identify the Firebase project and are not server secrets; access is controlled by Authentication and Firestore Security Rules. Never place service-account credentials in this repository or in browser code.

## 3. Configure GitHub Pages

Add these repository variables or secrets in **Settings > Secrets and variables > Actions**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_DATABASE_ID` (for this project: `kugaleaderboard`)
- `VITE_FIREBASE_APP_ID`

The Pages workflow already maps these values into the Vite build. Until they are configured, the game continues to work and shows the online leaderboard as unavailable.

## Data and security boundary

Each anonymous Firebase user can create or update only the Firestore document whose ID matches their Firebase user ID. Records contain only a callsign, best score, corresponding level, and server timestamp. Reads are public so visitors can view the Top 5. Existing records created before level tracking display an unknown level until the player records a new best.

The rules prevent score decreases and malformed writes, but they cannot prove that a score came from an untampered browser game. A server-authoritative game or score-verification service would be required for strong anti-cheat protection.
