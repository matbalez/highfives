import * as QRCode from 'qrcode';

// Generate QR code as data URL
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    // Generate QR code as data URL (PNG format)
    const dataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    return dataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}