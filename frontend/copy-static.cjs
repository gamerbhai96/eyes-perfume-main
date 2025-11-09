const fs = require('fs');
const path = require('path');

const files = ['static.json', '_redirects'];
const destDir = path.join(__dirname, 'dist');

// Ensure the destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

files.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to dist/${file}`);
  }
}); 