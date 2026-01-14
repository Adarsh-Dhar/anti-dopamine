const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio'); // Optional, but regex is faster for this specific task if you don't want to install deps

const OUT_DIR = path.join(process.cwd(), 'out');
const HTML_FILE = path.join(OUT_DIR, 'index.html');
const MANIFEST_FILE = path.join(OUT_DIR, 'manifest.json');

// 1. Helper to calculate SHA-256 hash
function getHash(content) {
  return crypto.createHash('sha256').update(content).digest('base64');
}

try {
  // 2. Read index.html
  if (!fs.existsSync(HTML_FILE)) {
    console.error(`❌ Error: Could not find ${HTML_FILE}. Did you run 'npm run build'?`);
    process.exit(1);
  }
  const html = fs.readFileSync(HTML_FILE, 'utf-8');

  // 3. Extract all inline scripts using Regex
  // Matches <script>...content...</script> but ignores <script src="...">
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  const hashes = new Set();

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1];
    if (scriptContent.trim()) {
      const hash = getHash(scriptContent);
      hashes.add(`'sha256-${hash}'`);
    }
  }

  console.log(`✅ Found ${hashes.size} inline scripts to whitelist.`);

  // 4. Read manifest.json
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`❌ Error: Could not find ${MANIFEST_FILE}.`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));

  // 5. Construct the Content Security Policy (CSP) string
  // We strictly allow 'self' and the hashes we found.
  const cspString = `script-src 'self' ${Array.from(hashes).join(' ')}; object-src 'self'`;

  // 6. Update manifest
  manifest.content_security_policy = {
    extension_pages: cspString,
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`🔒 CSP updated in manifest.json!`);

} catch (e) {
  console.error('❌ Failed to generate CSP:', e);
  process.exit(1);
}