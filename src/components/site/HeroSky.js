'use client';

import { useEffect, useState } from 'react';
import { sunPosition, moonPosition, moonPhase } from '@/lib/sun.js';

// Live sky over the home page photo, following the real sun and moon over
// Ulaanbaatar: bright by day, golden in the evening, red at sunset, then night
// blue with stars and the moon in its current phase. Drawn with SVG attributes
// only, because the CSP does not allow inline styles.

// Sky colour by the sun's altitude: [altitude, tint multiplied over the photo, glow around the sun].
const SKY = [
  [-18, [8, 14, 38, 0.82], [40, 40, 90, 0]],
  [-10, [22, 30, 80, 0.74], [90, 70, 160, 0.3]],
  [-5, [120, 60, 120, 0.62], [255, 90, 100, 0.65]],
  [-1, [240, 105, 60, 0.55], [255, 120, 50, 0.85]],
  [5, [255, 165, 90, 0.38], [255, 180, 90, 0.7]],
  [15, [255, 215, 160, 0.16], [255, 225, 170, 0.5]],
  [35, [255, 255, 255, 0], [255, 250, 230, 0.4]],
];

// Fixed pseudo-random stars (same on the server and in the browser), denser near the top.
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const STARS = Array.from({ length: 48 }, (_, i) => ({
  x: `${(2 + random() * 96).toFixed(1)}%`,
  y: `${(2 + random() * random() * 58).toFixed(1)}%`,
  r: (0.5 + random()).toFixed(2),
  twinkle: `tw${i % 3}`,
}));

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function skyColours(altitude) {
  const i = SKY.findIndex(([a]) => a >= altitude);
  if (i === 0) return SKY[0].slice(1);
  if (i === -1) return SKY.at(-1).slice(1);
  const [a0, ...from] = SKY[i - 1];
  const [a1, ...to] = SKY[i];
  const k = (altitude - a0) / (a1 - a0);
  return from.map((c, j) => c.map((v, n) => v + (to[j][n] - v) * k));
}

const rgb = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

// Positions inside the band above the hero text (.sky-band): azimuth from the
// south -> left (east) to right (west); altitude -> up from the band's bottom edge.
const skyX = (azimuth) => `${clamp(50 + (azimuth / 120) * 50, 4, 96).toFixed(1)}%`;
const skyY = (altitude) => `${clamp(90 - altitude * 1.2, 20, 100).toFixed(1)}%`;

// Moon outline for a phase, in a 100x100 box: the lit limb, then the terminator
// back as half an ellipse. Lit on the right while waxing (northern hemisphere).
function moonPath(phase) {
  const waxing = phase < 0.5;
  const k = Math.cos(2 * Math.PI * phase);
  const crescent = k > 0;
  const rx = (48 * Math.abs(k)).toFixed(2);
  return `M50 2A48 48 0 0 ${waxing ? 1 : 0} 50 98A${rx} 48 0 0 ${crescent === waxing ? 0 : 1} 50 2Z`;
}

export default function HeroSky({ at, preview }) {
  const [now, setNow] = useState(at);

  useEffect(() => {
    if (preview) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, [preview]);

  const date = new Date(now);
  const sun = sunPosition(date);
  const moon = moonPosition(date);
  const [tint, glow] = skyColours(sun.altitude);
  // 0 when the sun is 6° or more below the horizon, 1 when it is 6° or more above.
  const daylight = clamp((sun.altitude + 6) / 12);
  const sunOpacity = clamp((sun.altitude + 1.5) / 3);
  const starsOpacity = clamp((-sun.altitude - 6) / 8);
  // The moon is pale by day, bright at night.
  const moonOpacity = clamp(moon.altitude / 3) * (1 - 0.6 * daylight);
  // Sunrise/sunset light along the whole horizon, strongest just after sunset.
  const horizonOpacity = glow[3] * clamp(1 - Math.abs(sun.altitude + 2) / 10) * 0.8;
  const sunX = skyX(sun.azimuth);
  const sunY = skyY(sun.altitude);

  return (
    <>
      <svg className="sky-layer sky-tint" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill={rgb(tint)} fillOpacity={tint[3].toFixed(3)} />
      </svg>
      <svg className="sky-layer sky-band sky-glow" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="sky-glow">
            <stop offset="0" stopColor={rgb(glow)} stopOpacity={glow[3].toFixed(3)} />
            <stop offset="1" stopColor={rgb(glow)} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sky-horizon" x2="0" y2="1">
            <stop offset="0" stopColor={rgb(glow)} stopOpacity="0" />
            <stop offset="0.5" stopColor={rgb(glow)} stopOpacity={horizonOpacity.toFixed(3)} />
            <stop offset="1" stopColor={rgb(glow)} stopOpacity="0" />
          </linearGradient>
        </defs>
        {horizonOpacity > 0 && <rect width="100%" height="200%" fill="url(#sky-horizon)" />}
        <circle cx={sunX} cy={sunY} r="700" fill="url(#sky-glow)" />
      </svg>
      {starsOpacity > 0 && (
        <svg className="sky-layer sky-stars" aria-hidden="true" focusable="false" opacity={starsOpacity.toFixed(3)}>
          {STARS.map((s, i) => (
            <circle key={i} className={s.twinkle} cx={s.x} cy={s.y} r={s.r} fill="#fff" />
          ))}
        </svg>
      )}
      <svg className="sky-layer sky-band sky-bodies" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="sky-sun">
            <stop offset="0" stopColor="#fffdf5" />
            <stop offset="0.16" stopColor="#fff8e0" stopOpacity="0.95" />
            <stop offset="0.32" stopColor={rgb(glow)} stopOpacity="0.45" />
            <stop offset="1" stopColor={rgb(glow)} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sky-moon-glow">
            <stop offset="0.3" stopColor="#f4f1e6" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f4f1e6" stopOpacity="0" />
          </radialGradient>
        </defs>
        {moonOpacity > 0 && (
          <svg x={skyX(moon.azimuth)} y={skyY(moon.altitude)} overflow="visible" opacity={moonOpacity.toFixed(3)}>
            <circle r="44" fill="url(#sky-moon-glow)" />
            <g transform="translate(-15 -15) scale(0.3)">
              <circle cx="50" cy="50" r="48" fill="#fff" fillOpacity="0.1" />
              <path d={moonPath(moonPhase(date))} fill="#f4f1e6" />
            </g>
          </svg>
        )}
        {sunOpacity > 0 && <circle cx={sunX} cy={sunY} r="64" fill="url(#sky-sun)" opacity={sunOpacity.toFixed(3)} />}
      </svg>
    </>
  );
}
