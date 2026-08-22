import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="greenCross" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.2"/>
    </filter>
    <path id="textArcTop" d="M 60,256 A 196,196 0 0,1 452,256" fill="none"/>
  </defs>

  <!-- Outer Circle Background -->
  <circle cx="256" cy="256" r="248" fill="#0ea5e9"/>
  <circle cx="256" cy="256" r="236" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="12" filter="url(#shadow)"/>

  <!-- Inner Content -->
  <!-- Top Curved Text -->
  <text font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" fill="#be185d" letter-spacing="3">
    <textPath href="#textArcTop" startOffset="50%" text-anchor="middle">
      UPT PUSKESMAS SANANWETAN
    </textPath>
  </text>

  <!-- Head / Person Blue Swooshes -->
  <circle cx="256" cy="148" r="18" fill="#0284c7"/>
  <path d="M 175 190 C 230 145, 290 145, 340 190 C 310 180, 260 175, 220 195 Z" fill="#0284c7"/>

  <!-- Green Puskesmas Cross -->
  <g filter="url(#shadow)">
    <!-- Vertical Bar -->
    <rect x="216" y="200" width="80" height="150" rx="8" fill="url(#greenCross)"/>
    <!-- Horizontal Bar -->
    <rect x="181" y="235" width="150" height="80" rx="8" fill="url(#greenCross)"/>
  </g>

  <!-- Shelter / House Roof Outline & Rings on Cross -->
  <path d="M 210 280 L 256 240 L 302 280" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="244" cy="275" r="14" fill="none" stroke="#ffffff" stroke-width="5"/>
  <circle cx="268" cy="275" r="14" fill="none" stroke="#ffffff" stroke-width="5"/>

  <!-- Flowing Blue Wave / Ribbon -->
  <path d="M 270 320 C 310 325, 360 305, 380 270 C 370 300, 320 340, 270 335 Z" fill="url(#blueGrad)"/>

  <!-- Text KOTA BLITAR -->
  <text x="256" y="390" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#0f172a" text-anchor="middle" letter-spacing="2">
    KOTA BLITAR
  </text>

  <!-- Text PE GHPR -->
  <text x="256" y="426" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="30" fill="#0284c7" text-anchor="middle" letter-spacing="3">
    PE GHPR
  </text>

  <!-- Bottom Golden Caring Hands Arc -->
  <path d="M 120 425 C 160 450, 220 460, 270 445 C 240 455, 170 455, 130 435 Z" fill="url(#goldGrad)"/>
  <path d="M 392 425 C 352 450, 292 460, 242 445 C 272 455, 342 455, 382 435 Z" fill="url(#goldGrad)"/>
</svg>
`;

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0ea5e9"/>
  <g transform="translate(51.2, 51.2) scale(0.8)">
    ${svgIcon.replace(/<\?xml.*?\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
</svg>
`;

async function generate() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Save SVGs
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), svgIcon);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon);

  // Generate PNGs
  const buffer = Buffer.from(svgIcon);
  const maskableBuffer = Buffer.from(maskableSvg);

  await sharp(buffer).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(buffer).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));
  await sharp(buffer).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(buffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'maskable-icon-512.png'));
  await sharp(buffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(buffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico'));

  console.log('All icons generated successfully in public/!');
}

generate().catch(console.error);
