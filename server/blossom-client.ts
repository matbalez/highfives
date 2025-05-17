import { uploadBlob } from 'blossom-client-sdk/actions/upload';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import axios from 'axios';
import { createReadStream } from 'fs';

// Define the Blossom endpoint
const BLOSSOM_ENDPOINT = 'https://relay.blossom.band';

/**
 * Alternative upload method that doesn't require authentication - uploads to nostr.build
 * @param imageBuffer Buffer containing the image data to upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImageToNostrBuild(imageBuffer: Buffer): Promise<string> {
  try {
    console.log('Using nostr.build for image hosting...');
    
    // Create a temporary file to upload
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tmpDir, `${crypto.randomUUID()}.png`);
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    // Upload to nostr.build using axios and form-data
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', createReadStream(tempFilePath));
    
    const response = await axios.post('https://nostr.build/upload.php', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    // Extract URL from nostr.build response
    if (response.data && typeof response.data === 'string' && response.data.includes('https://')) {
      // Extract URL from HTML response
      const match = response.data.match(/https:\/\/nostr\.build\/i\/[a-zA-Z0-9]+\.(png|jpg|jpeg|gif)/);
      if (match && match[0]) {
        const imageUrl = match[0];
        console.log('Image uploaded successfully to nostr.build:', imageUrl);
        return imageUrl;
      }
    }
    
    throw new Error('Failed to extract image URL from nostr.build response');
  } catch (error) {
    console.error('Error uploading to nostr.build:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Uploads an image to a public hosting service
 * @param imageBuffer Buffer containing the image data to upload
 * @param mimeType MIME type of the image (e.g., 'image/png')
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImageToBlossom(
  imageBuffer: Buffer,
  mimeType: string = 'image/png'
): Promise<string> {
  // For now, skip Blossom due to auth issues and use nostr.build instead
  console.log('Using alternative image hosting instead of Blossom...');
  return await uploadImageToNostrBuild(imageBuffer);
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
    
    // Upload the buffer to the image hosting service
    const imageUrl = await uploadImageToNostrBuild(buffer);
    
    // Clean up the temporary file
    fs.unlinkSync(filename);
    
    console.log(`QR code uploaded successfully: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    return '';
  }
}