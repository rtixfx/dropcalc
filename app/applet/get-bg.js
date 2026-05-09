import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(msg.text());
  });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
    <img id="img" src="https://fortnite.gg/maps/40.30/2/0/0.webp" crossorigin="anonymous" />
    <canvas id="c"></canvas>
    <script>
      const img = document.getElementById('img');
      img.onload = () => {
        const c = document.getElementById('c');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const p = ctx.getImageData(0,0,1,1).data;
        console.log("COLOR:" + p[0] + "," + p[1] + "," + p[2]);
      };
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });

  setTimeout(() => process.exit(0), 3000);
})();
