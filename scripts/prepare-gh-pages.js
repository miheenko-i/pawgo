const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');
const noJekyllPath = path.join(distDir, '.nojekyll');

let html = fs.readFileSync(indexPath, 'utf8');

html = html
  .replaceAll('href="/favicon.ico"', 'href="./favicon.ico"')
  .replaceAll('src="/_expo/', 'src="./_expo/');

fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, notFoundPath);
fs.writeFileSync(noJekyllPath, '');
