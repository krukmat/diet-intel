const fs = require('fs');
const path = require('path');

// Create a simple HTML file that will render the apple emoji as an icon
const createHTMLIcon = () => {
  return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 1024px;
            height: 1024px;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
            font-family: system-ui, -apple-system, sans-serif;
        }
        .icon {
            font-size: 600px;
            line-height: 1;
            text-align: center;
            filter: drop-shadow(0 8px 16px rgba(0,0,0,0.1));
        }
    </style>
</head>
<body>
    <div class="icon">🍎</div>
</body>
</html>`;
};

// Create the HTML file
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

const htmlContent = createHTMLIcon();
fs.writeFileSync(path.join(assetsDir, 'icon-template.html'), htmlContent);

console.log('Icon template created! You can:');
console.log('1. Open assets/icon-template.html in a browser');
console.log('2. Take a screenshot or use browser dev tools to export as image');
console.log('3. Or use a headless browser to convert HTML to PNG');