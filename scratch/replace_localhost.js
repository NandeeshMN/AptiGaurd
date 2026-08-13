const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walkAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkAndReplace(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replace occurrences with single quotes
            if (content.includes("'http://localhost:5000")) {
                content = content.replace(/'http:\/\/localhost:5000([^']*)'/g, "`\\${import.meta.env.VITE_API_URL}$1`");
                modified = true;
            }

            // Replace occurrences with backticks
            if (content.includes("`http://localhost:5000")) {
                content = content.replace(/`http:\/\/localhost:5000([^`]*)`/g, "`\\${import.meta.env.VITE_API_URL}$1`");
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

walkAndReplace(srcDir);
