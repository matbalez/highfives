import { uploadBlob } from 'blossom-client-sdk/actions/upload';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

// Define the Blossom endpoint
const BLOSSOM_ENDPOINT = 'https://relay.blossom.band';

/**
 * Uploads an image to Blossom service
 * @param imageBuffer Buffer containing the image data to upload
 * @param mimeType MIME type of the image (e.g., 'image/png')
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImageToBlossom(
  imageBuffer: Buffer,
  mimeType: string = 'image/png'
): Promise<string> {
  try {
    console.log('Preparing to upload to Blossom...');
    console.log(`Uploading ${imageBuffer.length} bytes to Blossom...`);
    
    // Use uploadBlob directly
    const result = await uploadBlob(new URL(BLOSSOM_ENDPOINT), imageBuffer);

    // The result contains the URL of the uploaded image
    console.log('Blossom upload successful, image URL:', result.url);
    return result.url;
  } catch (error) {
    console.error('Error uploading to Blossom:', error);
    throw new Error(`Failed to upload image to Blossom: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a QR code PNG image and uploads it to Blossom
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded QR code image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  try {
    // Create a temporary directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Generate a temporary filename
    const filename = path.join(tmpDir, `${crypto.randomUUID()}.png`);
    
    // Generate the QR code as a PNG file
    await QRCode.toFile(filename, data, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log(`Generated QR code image: ${filename}`);
    
    // Read the file into a buffer
    const buffer = fs.readFileSync(filename);
    
    // Upload the buffer to Blossom
    const imageUrl = await uploadImageToBlossom(buffer, 'image/png');
    
    // Clean up the temporary file
    fs.unlinkSync(filename);
    
    console.log(`QR code uploaded to Blossom: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    throw error;
  }
}