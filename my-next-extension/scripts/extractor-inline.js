const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_DIR = path.join(process.cwd(), 'out');
const HTML_FILE = path.join(OUT_DIR, 'index.html');
const MANIFEST_FILE = path.join(OUT_DIR, 'manifest.json');

try {
  // 1. Read index.html
  if (!fs.existsSync(HTML_FILE)) {
    console.error(`❌ Error: Could not find ${HTML_FILE}.`);
    process.exit(1);
  }
  let html = fs.readFileSync(HTML_FILE, 'utf-8');

  // -----------------------------------------------------------------------
  // CRITICAL FIX: Remove 'async' and 'defer' from ALL scripts
  // This ensures React loads synchronously and hydrates the button immediately.
  // -----------------------------------------------------------------------
  html = html.replace(/<script[^>]+>/g, (tag) => {
    return tag.replace(/\s(async|defer)/g, '');
  });
  console.log('✅ Removed async/defer from scripts to ensure execution order.');

  // 2. Extract inline scripts
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gm;
  let scriptCount = 0;

  html = html.replace(scriptRegex, (match, attributes, content) => {
    // Skip if it has a src (external file)
    if (attributes.includes('src=')) return match;
    
    // Skip JSON data (Next.js props)
    if (attributes.includes('type="application/json"') || attributes.includes("type='application/json'")) return match;

    // Skip empty
    if (!content.trim()) return match;

    const filename = `script-${crypto.randomBytes(4).toString('hex')}.js`;
    const filePath = path.join(OUT_DIR, filename);

    fs.writeFileSync(filePath, content);
    scriptCount++;

    // Return the new script tag (without async/defer)
    const cleanAttributes = attributes.replace(/\s(async|defer)/g, '');
    return `<script src="${filename}"${cleanAttributes}></script>`;
  });

  console.log(`✅ Extracted ${scriptCount} inline scripts to external files.`);

  // 3. Save HTML
  fs.writeFileSync(HTML_FILE, html);

  // 4. Update Manifest
  if (fs.existsSync(MANIFEST_FILE)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    
    manifest.content_security_policy = {
      extension_pages: "script-src 'self'; object-src 'self'"
    };

    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`🔒 CSP updated to strict 'self' mode.`);
  }

} catch (e) {
  console.error('❌ Failed:', e);
  process.exit(1);
}