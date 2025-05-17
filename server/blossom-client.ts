import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { BlossomClient } from 'blossom-client-sdk';

// Define the Blossom server URL
const BLOSSOM_SERVER_URL = 'https://api.blossom.band';

// Using private key from environment or generate temporary one for uploads
// This is used to sign uploads - not the same as an API key
const blossomPrivateKey = process.env.BLOSSOM_PRIVATE_KEY || crypto.randomBytes(32).toString('hex');
console.log('Using Blossom private key for signed uploads');

/**
 * Uploads an image to Blossom service using the Blossom client SDK
 * @param imageBuffer Buffer containing the image data to upload
 * @param mimeType MIME type of the image (e.g., 'image/png')
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImageToBlossom(
  imageBuffer: Buffer,
  mimeType: string = 'image/png'
): Promise<string> {
  try {
    console.log('Preparing to upload to Blossom using SDK...');
    console.log(`Uploading ${imageBuffer.length} bytes to Blossom with MIME type ${mimeType}...`);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Empty image buffer provided for Blossom upload');
    }
    
    try {
      // Create a description for the file
      const fileDescription = `Image upload from High Fives App - ${new Date().toISOString()}`;
      
      // Create a Blossom upload auth event according to BUD-02 spec
      // https://github.com/hzrd149/blossom/blob/master/buds/02.md
      console.log('Creating Blossom upload auth...');
      const uploadAuth = await BlossomClient.createUploadAuth(
        imageBuffer, 
        BLOSSOM_SERVER_URL, 
        fileDescription
      );
      
      // Encode the auth header
      const encodedAuthHeader = BlossomClient.encodeAuthorizationHeader(uploadAuth);
      
      console.log('Created Blossom auth header successfully');
      
      // Make the upload request
      const blossom_upload_url = new URL('/upload', BLOSSOM_SERVER_URL);
      console.log(`Uploading to Blossom API: ${blossom_upload_url.toString()}`);
      
      const response = await fetch(blossom_upload_url, {
        method: 'PUT',
        body: imageBuffer,
        headers: { 
          authorization: encodedAuthHeader,
          'content-type': mimeType
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
      console.error('Detailed Blossom error:', uploadError);
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
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  let tempFilePath = '';
  
  try {
    console.log('Starting QR code generation process...');
    
    // Create a temporary directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Generate a unique filename for the QR code
    const filename = `qrcode-${crypto.randomUUID()}.png`;
    tempFilePath = path.join(tmpDir, filename);
    
    // Generate the QR code directly to a file
    console.log(`Generating QR code to: ${tempFilePath}`);
    await new Promise<void>((resolve, reject) => {
      QRCode.toFile(tempFilePath, data, {
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
    
    console.log(`QR code file created successfully`);
    
    // Verify file was created and has content
    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`QR code file was not created at ${tempFilePath}`);
    }
    
    const stats = fs.statSync(tempFilePath);
    console.log(`QR code file size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('Generated QR code file is empty');
    }
    
    // Read the file into a buffer
    const qrCodeBuffer = fs.readFileSync(tempFilePath);
    
    // Create a description for the QR code
    const fileDescription = `QR Code for Lightning Invoice - ${new Date().toISOString()}`;
    
    try {
      // Create a Blossom upload auth event
      console.log('Creating Blossom upload auth...');
      const uploadAuth = await BlossomClient.createUploadAuth(
        qrCodeBuffer, 
        BLOSSOM_SERVER_URL, 
        fileDescription, 
        blossomPrivateKey
      );
      
      // Encode it using base64
      const encodedAuthHeader = BlossomClient.encodeAuthorizationHeader(uploadAuth);
      
      console.log('Created Blossom auth header successfully');
      
      // Make the upload request
      const uploadUrl = new URL('/upload', BLOSSOM_SERVER_URL);
      console.log(`Uploading QR code to Blossom: ${uploadUrl.toString()}`);
      
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: qrCodeBuffer,
        headers: { 
          authorization: encodedAuthHeader,
          'content-type': 'image/png'
        }
      });
      
      console.log(`Blossom upload response status: ${response.status}`);
      
      // Check response
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blossom API responded with status ${response.status}: ${errorText}`);
      }
      
      // Parse response
      const result = await response.json() as { url?: string };
      console.log('Blossom API response:', JSON.stringify(result));
      
      // Extract URL
      if (!result || !result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary QR code file deleted: ${tempFilePath}`);
      }
      
      const uploadUrl = result.url as string;
      console.log(`QR code successfully uploaded to Blossom: ${uploadUrl}`);
      return uploadUrl;
    } catch (uploadError) {
      console.error('Detailed Blossom error:', uploadError);
      throw uploadError;
    } finally {
      // Clean up temporary file if it exists
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error('Error cleaning up temporary file:', cleanupError);
        }
      }
    }
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Clean up temporary file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file after error: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    throw new Error(`Blossom upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}