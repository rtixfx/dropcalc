import sharp from 'sharp';

async function run() {
  const { data } = await sharp('tile.webp').raw().toBuffer({ resolveWithObject: true });
  // The first pixel (0, 0)
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  console.log('BASE_MAP_HEX:', hex);
}
run();
