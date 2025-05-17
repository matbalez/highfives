import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import FormData from 'form-data';

// Define the Blossom endpoints - use the standard API endpoint
const BLOSSOM_UPLOAD_URL = 'https://api.blossom.band/v1/upload';
const BLOSSOM_ENDPOINT = 'https://api.blossom.band';

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
  // Create a temporary file to hold the image for uploading
  let tempFile = '';
  
  try {
    console.log('Preparing to upload to Blossom...');
    console.log(`Image buffer size: ${imageBuffer.length} bytes, MIME type: ${mimeType}`);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer provided for Blossom upload');
    }
    
    // Create a temporary directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Create a temporary file for the upload
    tempFile = path.join(tmpDir, `${crypto.randomUUID()}.png`);
    fs.writeFileSync(tempFile, imageBuffer);
    console.log(`Image saved to temporary file: ${tempFile}`);
    
    // Check if the API key is available
    const apiKey = process.env.BLOSSOM_API_KEY;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile));
    
    // Add API key if available
    if (apiKey) {
      console.log('Using BLOSSOM_API_KEY for authentication');
      formData.append('api_key', apiKey);
    } else {
      console.log('No BLOSSOM_API_KEY found, attempting anonymous upload');
    }
    
    // Send the upload request
    console.log(`Sending upload request to ${BLOSSOM_UPLOAD_URL}`);
    const response = await fetch(BLOSSOM_UPLOAD_URL, {
      method: 'POST',
      body: formData
    });
    
    // Always clean up the temporary file
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        console.log(`Cleaned up temporary file: ${tempFile}`);
        tempFile = ''; // Reset so we don't try to delete it again in the finally block
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary file:', cleanupError);
    }
    
    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Blossom API error (${response.status}): ${errorText}`);
      throw new Error(`Blossom upload failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse the response
    const responseData = await response.json() as any;
    console.log('Blossom API response:', JSON.stringify(responseData));
    
    // Check for success and URL
    if (responseData && responseData.success && responseData.url) {
      console.log('Blossom upload successful, URL:', responseData.url);
      return responseData.url;
    } else {
      console.error('Blossom API responded without a URL:', responseData);
      throw new Error('Blossom upload succeeded but no URL was returned');
    }
  } catch (error) {
    console.error('Error uploading to Blossom:', error);
    
    // Cleanup temporary file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
        console.log(`Cleaned up temporary file after error: ${tempFile}`);
      } catch (cleanupError) {
        console.error('Failed to clean up temporary file:', cleanupError);
      }
    }
    
    throw new Error(`Failed to upload image to Blossom: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a QR code PNG image and uploads it to Blossom
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded QR code image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  let buffer: Buffer | null = null;
  
  try {
    console.log('Starting QR code generation process for data with length:', data.length);
    
    // Generate QR code directly to buffer
    console.log('Generating QR code to buffer...');
    buffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
    });
    
    console.log(`Generated QR code buffer with size: ${buffer.length} bytes`);
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated QR code buffer is empty');
    }
    
    // Upload the buffer to Blossom
    console.log('Uploading QR code to Blossom...');
    const imageUrl = await uploadImageToBlossom(buffer, 'image/png');
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
    
    // Fallback to local storage if Blossom upload fails
    try {
      console.log('Falling back to local QR code storage...');
      // Make sure we have a buffer
      if (!buffer) {
        buffer = await QRCode.toBuffer(data, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 400,
        });
        console.log(`Generated fallback QR code buffer with size: ${buffer.length} bytes`);
      }
      
      // Ensure public directory exists
      const publicPath = path.join(process.cwd(), 'public', 'qr-codes');
      if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
      }
      
      // Save the buffer to a local file
      const filename = `qrcode-${crypto.randomUUID()}.png`;
      const filePath = path.join(publicPath, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved QR code locally at: ${filePath}`);
      
      // Return a relative URL that can be referenced in the frontend
      return `/qr-codes/${filename}`;
    } catch (fallbackError) {
      console.error('Even fallback QR code generation failed:', fallbackError);
      throw new Error(`Failed to generate and save QR code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}