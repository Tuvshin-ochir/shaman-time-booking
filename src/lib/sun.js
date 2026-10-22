// Sun and moon over Ulaanbaatar, for the home page sky and the automatic night
// theme. Low-precision formulas (about 1° for the sun, a few degrees for the
// moon) are plenty for that. Only the UTC instant matters, so the result is the
// same whatever time zone the visitor's device is set to.
const LAT = 47.92 * (Math.PI / 180);
const LON = 106.92;
const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const OBLIQUITY = 23.4397 * RAD;
// The sun's centre is this far below the horizon at sunrise and sunset.
const HORIZON = -0.833;

const days = (date) => (date.getTime() - J2000) / DAY_MS;

// Altitude above the horizon and azimuth from the south (east negative, west
// positive), both in degrees.
function horizontal(d, ra, dec) {
  const hourAngle = (280.16 + 360.9856235 * d + LON) * RAD - ra;
  const altitude = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(hourAngle));
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT));
  return { altitude: altitude / RAD, azimuth: azimuth / RAD };
}

function equatorial(longitude, latitude) {
  return {
    ra: Math.atan2(Math.sin(longitude) * Math.cos(OBLIQUITY) - Math.tan(latitude) * Math.sin(OBLIQUITY), Math.cos(longitude)),
    dec: Math.asin(Math.sin(latitude) * Math.cos(OBLIQUITY) + Math.cos(latitude) * Math.sin(OBLIQUITY) * Math.sin(longitude)),
  };
}

export function sunPosition(date = new Date()) {
  const d = days(date);
  const m = (357.5291 + 0.98560028 * d) * RAD;
  const center = (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) * RAD;
  const { ra, dec } = equatorial(m + center + 102.9372 * RAD + Math.PI, 0);
  return horizontal(d, ra, dec);
}

export function moonPosition(date = new Date()) {
  const d = days(date);
  const l = (218.316 + 13.176396 * d) * RAD;
  const m = (134.963 + 13.064993 * d) * RAD;
  const f = (93.272 + 13.22935 * d) * RAD;
  const { ra, dec } = equatorial(l + 6.289 * RAD * Math.sin(m), 5.128 * RAD * Math.sin(f));
  return horizontal(d, ra, dec);
}

// 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
export function moonPhase(date = new Date()) {
  const phase = (days(date) - 5.2597) / 29.530589;
  return phase - Math.floor(phase);
}

export const isNight = (date = new Date()) => sunPosition(date).altitude < HORIZON;

// The next sunrise or sunset after `date`.
export function nextSunChange(date = new Date()) {
  const night = isNight(date);
  let lo = date.getTime();
  let hi = lo;
  do {
    lo = hi;
    hi += 10 * 60000;
  } while (isNight(new Date(hi)) === night && hi - date.getTime() < 2 * DAY_MS);
  while (hi - lo > 30000) {
    const mid = (lo + hi) / 2;
    if (isNight(new Date(mid)) === night) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}
