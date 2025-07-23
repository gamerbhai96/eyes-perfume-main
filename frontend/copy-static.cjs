const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'static.json');
const destDir = path.join(__dirname, 'dist');
const dest = path.join(destDir, 'static.json');

// Ensure the destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('Copied static.json to dist/static.json'); 