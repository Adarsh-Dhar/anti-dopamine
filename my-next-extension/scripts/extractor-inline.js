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

  // 2. Find and extract inline scripts
  // We match <script> tags that do NOT have a 'src' attribute and are NOT JSON data
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gm;
  let scriptCount = 0;

  html = html.replace(scriptRegex, (match, attributes, content) => {
    // Skip if it already has a source
    if (attributes.includes('src=')) return match;
    
    // Skip if it's JSON data (Next.js uses this for props)
    if (attributes.includes('type="application/json"') || attributes.includes("type='application/json'")) return match;

    // Skip empty scripts
    if (!content.trim()) return match;

    // Generate a unique filename for this script
    const filename = `script-${crypto.randomBytes(4).toString('hex')}.js`;
    const filePath = path.join(OUT_DIR, filename);

    // Write the content to a new file
    fs.writeFileSync(filePath, content);
    scriptCount++;

    // Replace the inline script with a link to the new file
    // We keep original attributes (like async/defer) just in case
    return `<script src="${filename}"${attributes}></script>`;
  });

  console.log(`✅ Extracted ${scriptCount} inline scripts to external files.`);

  // 3. Save the modified HTML
  fs.writeFileSync(HTML_FILE, html);

  // 4. Update manifest.json
  // Now we only need to allow 'self'. No hashes needed!
  if (fs.existsSync(MANIFEST_FILE)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    
    manifest.content_security_policy = {
      extension_pages: "script-src 'self'; object-src 'self'"
    };

    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`🔒 CSP updated to strict 'self' mode.`);
  }

} catch (e) {
  console.error('❌ Failed to extract scripts:', e);
  process.exit(1);
}