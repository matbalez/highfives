import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { finalizeEvent, getEventHash, getPublicKey, type Event, type EventTemplate } from 'nostr-tools';

// Define the Blossom API endpoint for regular non-SDK uploads
const BLOSSOM_UPLOAD_ENDPOINT = 'https://api.blossom.band/v1/upload';

/**
 * Uploads an image to Blossom service using direct upload
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
    console.log(`Uploading ${imageBuffer.length} bytes to Blossom with MIME type ${mimeType}...`);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer provided for Blossom upload');
    }
    
    // Create a temporary file from the buffer
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tmpDir, `blossom-upload-${crypto.randomUUID()}.png`);
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    console.log(`Created temporary file for upload: ${tempFilePath}`);
    
    try {
      // Create form data for the upload
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath));
      
      // Upload to Blossom API
      console.log(`Uploading to Blossom API: ${BLOSSOM_UPLOAD_ENDPOINT}`);
      const response = await fetch(BLOSSOM_UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });
      
      // Log response status
      console.log(`Blossom API response status: ${response.status}`);
      
      // Check if the upload was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blossom API responded with status ${response.status}: ${errorText}`);
      }
      
      // Parse the response
      const result = await response.json() as any;
      console.log('Blossom API response:', JSON.stringify(result));
      
      // Check for success and URL
      if (!result) {
        throw new Error('Blossom upload failed: Empty response');
      }
      
      if (!result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      // Return the URL of the uploaded image
      console.log('Blossom upload successful, image URL:', result.url);
      return result.url;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }
    }
  } catch (error) {
    console.error('Error uploading to Blossom:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw new Error(`Failed to upload image to Blossom: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a QR code PNG image and uploads it to Blossom API
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  try {
    console.log('Starting QR code generation process for Lightning invoice...');
    
    // Generate QR code as PNG buffer
    const qrCodeBuffer = await new Promise<Buffer>((resolve, reject) => {
      QRCode.toBuffer(data, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    
    console.log(`Generated QR code buffer size: ${qrCodeBuffer.length} bytes`);
    
    // Upload the QR code to Blossom using our updated function
    const imageUrl = await uploadImageToBlossom(qrCodeBuffer, 'image/png');
    console.log(`QR code successfully uploaded to Blossom: ${imageUrl}`);
    
    return imageUrl;
  } catch (error) {
    console.error('Error generating or uploading QR code:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Create a data URL as fallback if Blossom upload fails
    try {
      console.log('Blossom upload failed, falling back to data URL...');
      const dataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      console.log('Successfully generated QR code as data URL');
      return dataUrl;
    } catch (fallbackError) {
      console.error('Even data URL fallback failed:', fallbackError);
      throw error; // Throw the original error
    }
  }
}