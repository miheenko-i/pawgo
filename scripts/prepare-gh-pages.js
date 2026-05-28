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

const googleFonts = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Geologica:wght@400;500;600;700;800&display=swap" rel="stylesheet">',
].join('');

html = html.replace('</head>', `${googleFonts}</head>`);

fs.writeFileSync(indexPath, html);
fs.copyFileSync(indexPath, notFoundPath);
fs.writeFileSync(noJekyllPath, '');
