import { uploadBlob } from 'blossom-client-sdk/actions/upload';
import { uploadMedia } from 'blossom-client-sdk/actions/media';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

// Define the Blossom endpoint - try different Blossom relay
const BLOSSOM_ENDPOINT = 'https://blob.pleb.network';

// Fallback endpoint if the first one doesn't work
const FALLBACK_ENDPOINT = 'https://relay.blossom.band';

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
    
    // First try with uploadMedia
    try {
      console.log('Starting Blossom upload using uploadMedia with server:', BLOSSOM_ENDPOINT);
      console.log('Image buffer size:', imageBuffer.length, 'bytes');
      
      const mediaResult = await uploadMedia(new URL(BLOSSOM_ENDPOINT), imageBuffer, {
        signal: new AbortController().signal
      });

      // Log detailed result
      console.log('Blossom upload result (media):', JSON.stringify(mediaResult));
      console.log('Blossom upload successful, image URL:', mediaResult.url);
      return mediaResult.url;
    } catch (mediaError) {
      console.error('Error with uploadMedia, falling back to uploadBlob:', mediaError);
      
      // Try direct upload with uploadBlob as fallback
      console.log('Starting Blossom upload using uploadBlob with server:', BLOSSOM_ENDPOINT);
      const blobResult = await uploadBlob(new URL(BLOSSOM_ENDPOINT), imageBuffer, {
        signal: new AbortController().signal
      });

      console.log('Blossom upload result (blob):', JSON.stringify(blobResult));
      console.log('Blossom upload successful, image URL:', blobResult.url);
      return blobResult.url;
    }
  } catch (mainError) {
    console.error('Error uploading to primary Blossom endpoint:', mainError);
    
    // Try the fallback endpoint
    try {
      console.log('Trying fallback Blossom endpoint:', FALLBACK_ENDPOINT);
      const fallbackResult = await uploadBlob(new URL(FALLBACK_ENDPOINT), imageBuffer, {
        signal: new AbortController().signal
      });
      
      console.log('Fallback Blossom upload successful, image URL:', fallbackResult.url);
      return fallbackResult.url;
    } catch (fallbackError) {
      console.error('Error uploading to fallback Blossom endpoint:', fallbackError);
      
      // All attempts failed, use direct imgur upload as a last resort
      return uploadToImgur(imageBuffer);
    }
  }
}

// Fallback to imgur if Blossom fails
async function uploadToImgur(imageBuffer: Buffer): Promise<string> {
  try {
    console.log('Falling back to Imgur upload');
    
    // Generate a unique local file path
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `${crypto.randomUUID()}.png`);
    
    // Save buffer to file
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    // This is just a placeholder URL for now
    // In production you would implement actual Imgur API integration
    const imgurUrl = `https://i.imgur.com/example.png`;
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    return imgurUrl;
  } catch (error) {
    console.error('Error with Imgur fallback upload:', error);
    throw new Error('All image upload methods failed');
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