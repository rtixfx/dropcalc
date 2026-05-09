import fs from 'fs';
import https from 'https';

https.get('https://fortnite.gg/maps/40.30/2/0/0.webp', (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    fs.writeFileSync('tile.webp', buf);
    console.log('Downloaded tile.webp, size:', buf.length);
  });
});
