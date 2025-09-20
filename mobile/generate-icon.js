const fs = require('fs');
const path = require('path');

// Create a simple SVG icon with the apple emoji
const createAppleIcon = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#f8f9fa"/>
  <text x="50%" y="50%" font-family="system-ui, -apple-system, sans-serif"
        font-size="${size * 0.6}" text-anchor="middle"
        dominant-baseline="central" fill="#2d5a27">🍎</text>
</svg>`;
};

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Generate the main icon (1024x1024 for high quality)
const iconSVG = createAppleIcon(1024);
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSVG);

console.log('Apple icon generated successfully!');
console.log('Generated files:');
console.log('- assets/icon.svg (1024x1024)');