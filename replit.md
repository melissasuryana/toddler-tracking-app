# Running on Replit

The Expo app's web preview runs on port 5000 with:

```sh
npm run web --workspace app -- --port 5000 --host lan
```

Install workspace dependencies with `npm install`. The browser version uses an
in-memory data session, so child details and preferences do not persist after a
page reload; the native app uses the local SQLite-backed session.
