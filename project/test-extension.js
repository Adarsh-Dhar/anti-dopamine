import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing Browser Extension Build...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, assertion) {
  try {
    if (assertion()) {
      console.log(`✓ ${name}`);
      testsPassed++;
      return true;
    } else {
      console.log(`✗ ${name}`);
      testsFailed++;
      return false;
    }
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    testsFailed++;
    return false;
  }
}

test('dist folder exists', () => {
  return existsSync(resolve(__dirname, 'dist'));
});

test('manifest.json exists in dist', () => {
  return existsSync(resolve(__dirname, 'dist/manifest.json'));
});

test('index.html exists in dist', () => {
  return existsSync(resolve(__dirname, 'dist/index.html'));
});

test('manifest.json is valid JSON', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, 'dist/manifest.json'), 'utf-8')
  );
  return manifest.manifest_version === 3;
});

test('manifest.json has correct name', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, 'dist/manifest.json'), 'utf-8')
  );
  return manifest.name === 'Hello World Extension';
});

test('manifest.json has action.default_popup', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, 'dist/manifest.json'), 'utf-8')
  );
  return manifest.action && manifest.action.default_popup === 'index.html';
});

test('index.html uses relative paths', () => {
  const html = readFileSync(resolve(__dirname, 'dist/index.html'), 'utf-8');
  return html.includes('./assets/') && !html.includes('src="/assets/');
});

test('assets folder exists', () => {
  return existsSync(resolve(__dirname, 'dist/assets'));
});

console.log(`\n${testsPassed} tests passed, ${testsFailed} tests failed\n`);

if (testsFailed === 0) {
  console.log('All tests passed! Extension build is ready.\n');
  console.log('To test the extension in your browser:');
  console.log('\n1. Chrome/Edge:');
  console.log('   - Open chrome://extensions/');
  console.log('   - Enable "Developer mode" in the top right');
  console.log('   - Click "Load unpacked"');
  console.log('   - Select the "dist" folder');
  console.log('   - Click the extension icon in the toolbar');
  console.log('   - Open the browser console (F12)');
  console.log('   - Click the "Click Me" button');
  console.log('   - You should see "hello world" logged in the console');
  console.log('\n2. Firefox:');
  console.log('   - Open about:debugging#/runtime/this-firefox');
  console.log('   - Click "Load Temporary Add-on"');
  console.log('   - Select the manifest.json file in the "dist" folder');
  console.log('   - Click the extension icon in the toolbar');
  console.log('   - Open the browser console (F12)');
  console.log('   - Click the "Click Me" button');
  console.log('   - You should see "hello world" logged in the console');
  process.exit(0);
} else {
  console.log('Some tests failed. Please check the build.');
  process.exit(1);
}
