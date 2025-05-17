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
    console.log(`Uploading ${imageBuffer.length} bytes to Blossom with MIME type ${mimeType}...`);
    console.log(`Using Blossom endpoint: ${BLOSSOM_ENDPOINT}`);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer provided for Blossom upload');
    }
    
    // Check if the buffer is valid and looks like an image
    const header = imageBuffer.slice(0, 8).toString('hex');
    console.log(`Image file signature (first 8 bytes): ${header}`);
    
    try {
      // Use uploadBlob directly from the Blossom SDK
      const result = await uploadBlob(new URL(BLOSSOM_ENDPOINT), imageBuffer);
      console.log('Blossom SDK response:', JSON.stringify(result));
      
      if (!result || !result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      // The result contains the URL of the uploaded image
      console.log('Blossom upload successful, image URL:', result.url);
      return result.url;
    } catch (uploadError) {
      console.error('Detailed Blossom SDK error:', uploadError);
      if (uploadError instanceof Error) {
        console.error('Error name:', uploadError.name);
        console.error('Error message:', uploadError.message);
        console.error('Error stack:', uploadError.stack);
      }
      throw uploadError;
    }
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
  let filename = '';
  
  try {
    console.log('Starting QR code generation process for data with length:', data.length);
    
    // Create a temporary directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      console.log(`Creating temporary directory: ${tmpDir}`);
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Generate a temporary filename
    const uuid = crypto.randomUUID();
    filename = path.join(tmpDir, `${uuid}.png`);
    console.log(`Using temporary filename: ${filename}`);
    
    // Generate the QR code as a PNG file
    const qrOptions = {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    };
    
    console.log('Generating QR code with options:', JSON.stringify(qrOptions));
    await QRCode.toFile(filename, data, qrOptions);
    
    console.log(`QR code image successfully generated at: ${filename}`);
    
    // Check file existence and size
    if (!fs.existsSync(filename)) {
      throw new Error(`QR code file was not created at ${filename}`);
    }
    
    const stats = fs.statSync(filename);
    console.log(`QR code file size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('Generated QR code file is empty');
    }
    
    // Read the file into a buffer
    console.log('Reading file into buffer...');
    const buffer = fs.readFileSync(filename);
    console.log(`Buffer created with size: ${buffer.length} bytes`);
    
    if (buffer.length === 0) {
      throw new Error('QR code buffer is empty');
    }
    
    // Upload the buffer to Blossom
    console.log('Starting upload to Blossom...');
    const imageUrl = await uploadImageToBlossom(buffer, 'image/png');
    
    // Clean up the temporary file
    console.log(`Cleaning up temporary file: ${filename}`);
    fs.unlinkSync(filename);
    
    console.log(`QR code successfully uploaded to Blossom: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // If the file was created but there was an error later, try to clean up
    if (filename && fs.existsSync(filename)) {
      try {
        console.log(`Attempting to clean up temporary file after error: ${filename}`);
        fs.unlinkSync(filename);
        console.log('Temporary file cleanup successful');
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    throw error;
  }
}