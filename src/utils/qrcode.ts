import QRCode from 'qrcode';

// Anthropic brand colors
const BRAND_DARK = '#141413';
const BRAND_LIGHT = '#faf9f5';

export async function generateQRCode(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 256,
    margin: 2,
    color: {
      dark: BRAND_DARK,
      light: BRAND_LIGHT,
    },
  });
}

export async function generateQRCodeCanvas(
  data: string,
  canvas: HTMLCanvasElement
): Promise<void> {
  await QRCode.toCanvas(canvas, data, {
    width: 256,
    margin: 2,
    color: {
      dark: BRAND_DARK,
      light: BRAND_LIGHT,
    },
  });
}

export function downloadQRCode(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
