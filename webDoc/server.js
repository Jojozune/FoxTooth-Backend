const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve the webDoc static files
app.use('/', express.static(path.join(__dirname)));

// Serve docs folder from project root at /docs
const docsPath = path.join(__dirname, '..', 'docs');
app.use('/docs', express.static(docsPath));

// API endpoint to list available docs (filenames)
app.get('/api/docs', (req, res) => {
  fs.readdir(docsPath, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read docs folder' });
    // filter .md files and return sorted list
    const md = files.filter(f => f.endsWith('.md')).sort();
    res.json({ files: md });
  });
});

app.listen(PORT, () => {
  console.log(`Docs server running on http://localhost:${PORT}`);
});
