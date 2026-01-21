This folder contains the canonical Markdown documentation used by the project's local docs server and the webDoc viewer.

How it works:
- Files in this folder are served at `/docs/<filename>` by the docs server (`webDoc/server.js`).
- The viewer (`webDoc/index.html`) calls `/api/docs` to get the list of available markdown files and then fetches each file from `/docs/<filename>`.

To run the docs server locally:

```powershell
npm run start:docs
```

Then open http://localhost:8080/ in your browser.

