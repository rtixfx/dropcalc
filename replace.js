const fs = require('fs');
const content = fs.readFileSync('src/DropMap.tsx', 'utf8');
let newContent = content.replace(/emerald/g, 'violet').replace(/teal/g, 'indigo');
fs.writeFileSync('src/DropMap.tsx', newContent);
