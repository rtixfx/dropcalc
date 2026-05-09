import fs from 'fs';

for (const file of ['src/DropMap.tsx', 'src/Landing.tsx', 'src/index.css']) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/rose/g, 'violet');
  content = content.replace(/orange/g, 'indigo');
  content = content.replace(/f43f5e/g, '8b5cf6'); 
  content = content.replace(/f97316/g, '6366f1'); 
  content = content.replace(/244,63,94/g, '139,92,246');
  content = content.replace(/244, 63, 94/g, '139, 92, 246'); 
  fs.writeFileSync(file, content);
}
