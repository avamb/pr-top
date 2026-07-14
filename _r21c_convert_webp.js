/**
 * R21c: Convert hero-dashboard.png → real WebP
 * - Quality 85, lossless=false
 * - Target ≤ 120 KB
 * - Falls back to 1920×1200 downscale if > 120 KB at full resolution
 * - Deletes PNG duplicate when done
 * - Verifies magic bytes (RIFF...WEBP)
 */

const path = require('path');
const fs = require('fs');

// Use sharp from frontend node_modules
const sharp = require(path.join(__dirname, 'src/frontend/node_modules/sharp'));

const INPUT_PNG   = path.join(__dirname, 'src/frontend/public/images/hero-dashboard.png');
const OUTPUT_WEBP = path.join(__dirname, 'src/frontend/public/images/hero-dashboard.webp');
const MAX_BYTES   = 120 * 1024; // 120 KB

async function convert() {
  // Get original dimensions
  const meta = await sharp(INPUT_PNG).metadata();
  console.error(`Input: ${meta.width}x${meta.height} PNG, ${fs.statSync(INPUT_PNG).size} bytes`);

  // Try quality 85 at original size
  let buf = await sharp(INPUT_PNG)
    .webp({ quality: 85, effort: 6 })
    .toBuffer();

  console.error(`Quality 85 full res: ${buf.length} bytes`);

  if (buf.length > MAX_BYTES) {
    // Try downscale to 1920×1200 with quality 85
    buf = await sharp(INPUT_PNG)
      .resize({ width: 1920, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toBuffer();
    console.error(`Quality 85 @ 1920×1200: ${buf.length} bytes`);
  }

  if (buf.length > MAX_BYTES) {
    // Further reduce quality
    for (let q = 80; q >= 60 && buf.length > MAX_BYTES; q -= 5) {
      buf = await sharp(INPUT_PNG)
        .resize({ width: 1920, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: q, effort: 6 })
        .toBuffer();
      console.error(`Quality ${q} @ 1920×1200: ${buf.length} bytes`);
    }
  }

  // Write real WebP
  fs.writeFileSync(OUTPUT_WEBP, buf);
  console.error(`Written: ${OUTPUT_WEBP} (${buf.length} bytes)`);

  // Verify magic bytes: starts with RIFF and has WEBP at offset 8
  const magic = Buffer.alloc(12);
  const fd = fs.openSync(OUTPUT_WEBP, 'r');
  fs.readSync(fd, magic, 0, 12, 0);
  fs.closeSync(fd);

  const riff = magic.slice(0, 4).toString('ascii');
  const webp = magic.slice(8, 12).toString('ascii');

  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error(`Magic bytes check FAILED: got ${riff}...${webp}`);
  }
  console.error(`Magic bytes OK: ${riff}....${webp}`);

  // Delete PNG duplicate
  if (fs.existsSync(INPUT_PNG)) {
    fs.unlinkSync(INPUT_PNG);
    console.error(`Deleted PNG duplicate: ${INPUT_PNG}`);
  }

  // Final size check
  const finalSize = fs.statSync(OUTPUT_WEBP).size;
  if (finalSize > MAX_BYTES) {
    throw new Error(`Final size ${finalSize} bytes exceeds limit of ${MAX_BYTES} bytes (120 KB)`);
  }

  // Report results
  process.stdout.write(JSON.stringify({
    ok: true,
    outputPath: OUTPUT_WEBP,
    sizeBytes: finalSize,
    sizeKB: Math.round(finalSize / 1024),
    magicBytes: `${riff}....${webp}`,
  }) + '\n');
}

convert().catch(err => {
  process.stderr.write('ERROR: ' + err.message + '\n');
  process.exit(1);
});
