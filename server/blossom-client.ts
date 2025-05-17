import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Define the Blossom API endpoints
const BLOSSOM_API_URL = 'https://api.blossom.band';
const BLOSSOM_UPLOAD_ENDPOINT = `${BLOSSOM_API_URL}/upload`;

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
      
      // Add the image as a file
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: path.basename(tempFilePath),
        contentType: mimeType
      });
      
      // Log the Blossom API endpoint being used
      console.log(`Uploading to Blossom API: ${BLOSSOM_UPLOAD_ENDPOINT}`);
      
      // Make the request to Blossom API
      const response = await fetch(BLOSSOM_UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          ...formData.getHeaders()
        }
      });
      
      // Check if the upload was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blossom API responded with status ${response.status}: ${errorText}`);
      }
      
      // Parse the response
      const result = await response.json() as any;
      console.log('Blossom API response:', JSON.stringify(result));
      
      if (!result || !result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      // The result contains the URL of the uploaded image
      console.log('Blossom upload successful, image URL:', result.url);
      return result.url;
    } catch (uploadError) {
      console.error('Detailed Blossom API error:', uploadError);
      if (uploadError instanceof Error) {
        console.error('Error name:', uploadError.name);
        console.error('Error message:', uploadError.message);
        console.error('Error stack:', uploadError.stack);
      }
      throw uploadError;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      }
    }
  } catch (error) {
    console.error('Error uploading to Blossom:', error);
    throw new Error(`Failed to upload image to Blossom: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a QR code PNG image and uploads it to Blossom
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  let filename = '';
  
  try {
    console.log('Starting QR code generation process for Lightning invoice...');
    
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
    
    // Generate QR code image
    console.log('Generating QR code image...');
    
    // Use toFile method properly with correct options type
    await new Promise<void>((resolve, reject) => {
      QRCode.toFile(filename, data, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    console.log(`QR code image successfully generated at: ${filename}`);
    
    // Check if file exists and has content
    if (!fs.existsSync(filename)) {
      throw new Error(`QR code file was not created at ${filename}`);
    }
    
    const stats = fs.statSync(filename);
    console.log(`QR code file size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('Generated QR code file is empty');
    }
    
    // Upload the file directly (instead of buffer) to Blossom
    console.log('Starting upload to Blossom API...');
    
    // Create form data for the upload
    const formData = new FormData();
    
    // Add the image file to form data
    formData.append('file', fs.createReadStream(filename), {
      filename: path.basename(filename),
      contentType: 'image/png'
    });
    
    // Make the request to Blossom API
    const response = await fetch(BLOSSOM_UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders()
      }
    });
    
    // Check if the upload was successful
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blossom API responded with status ${response.status}: ${errorText}`);
    }
    
    // Parse the response
    const result = await response.json() as any;
    console.log('Blossom API response:', JSON.stringify(result));
    
    if (!result || !result.url) {
      throw new Error('Blossom upload failed: Missing URL in response');
    }
    
    // Clean up the temporary file
    console.log(`Cleaning up temporary file: ${filename}`);
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
    
    // The result contains the URL of the uploaded image
    console.log(`QR code successfully uploaded to Blossom: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Clean up any temporary files
    if (filename && fs.existsSync(filename)) {
      try {
        console.log(`Cleaning up temporary file after error: ${filename}`);
        fs.unlinkSync(filename);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    throw error;
  }
}