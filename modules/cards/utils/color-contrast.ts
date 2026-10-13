/**
 * Calculates optimal text color (#1e293b or #ffffff) based on WCAG 2.1
 * perceived luminance standards to ensure high contrast and readability.
 */
export function getContrastTextColor(hexColor?: string | null): string {
  if (!hexColor || hexColor === 'transparent') {
    return '#1e293b';
  }

  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }

  if (hex.length !== 6) {
    return '#ffffff';
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // WCAG YIQ perceived brightness: 0.299*R + 0.587*G + 0.114*B
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  // Threshold 165 ensures colors like yellow, mint, pastel pink, light blue get dark text
  return yiq >= 165 ? '#1e293b' : '#ffffff';
}

