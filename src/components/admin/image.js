// Image files picked in the admin are resized and re-encoded in the browser
// before upload (home page editor, news pictures).

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Зургийг уншиж чадсангүй. JPG эсвэл PNG зураг сонгоно уу.'));
    };
    img.src = url;
  });
}

// Scales down (never up) and optionally centre-crops to `ratio` (width / height).
export function encode(img, maxWidth, ratio) {
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ratio) {
    if (sw / sh > ratio) {
      const cropW = Math.round(sh * ratio);
      sx = Math.round((sw - cropW) / 2);
      sw = cropW;
    } else {
      const cropH = Math.round(sw / ratio);
      sy = Math.round((sh - cropH) / 2);
      sh = cropH;
    }
  }
  const width = Math.min(maxWidth, sw);
  const height = Math.round((width * sh) / sw);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), width, height };
}
