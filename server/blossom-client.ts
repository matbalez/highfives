import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import * as BlossomClient from 'blossom-client-sdk';

// Define the Blossom server URL
const BLOSSOM_SERVER_URL = 'https://relay.blossom.band';

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
    
    try {
      // Create a temporary file from the buffer to upload
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tmpDir, `blossom-upload-${crypto.randomUUID()}.png`);
      fs.writeFileSync(tempFilePath, imageBuffer);
      
      console.log(`Created temporary file for upload: ${tempFilePath}`);
      
      // Create form data for the upload
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath));
      
      // Upload to Blossom API
      console.log(`Uploading to Blossom API: ${BLOSSOM_UPLOAD_API}`);
      const response = await fetch(BLOSSOM_UPLOAD_API, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
      
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
 * Generates a QR code PNG image and uploads it to Blossom using the SDK
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  try {
    console.log('Starting QR code generation process for Lightning invoice...');
    
    // Generate QR code directly as a buffer
    console.log('Generating QR code as PNG buffer...');
    const qrCodeBuffer = await new Promise<Buffer>((resolve, reject) => {
      QRCode.toBuffer(data, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer);
        }
      });
    });
    
    console.log(`Generated QR code buffer with size: ${qrCodeBuffer.length} bytes`);
    
    if (!qrCodeBuffer || qrCodeBuffer.length === 0) {
      throw new Error('Generated QR code buffer is empty');
    }
    
    // Use precisely the approach from the Blossom documentation
    const server = new URL(BLOSSOM_SERVER_URL);
    console.log(`Uploading to Blossom server: ${server.toString()}`);
    
    try {
      // Create an upload auth event - this creates a Nostr event authorizing the upload
      console.log('Creating upload auth event...');
      const uploadAuth = await BlossomClient.createUploadAuth(
        qrCodeBuffer, 
        server, 
        "QR Code for Lightning Payment"
      );
      
      // Encode it using base64
      console.log('Encoding authorization header...');
      const encodedAuthHeader = BlossomClient.encodeAuthorizationHeader(uploadAuth);
      
      // Manually make the request
      console.log('Making PUT request to upload endpoint...');
      const response = await fetch(new URL("/upload", server), {
        method: "PUT",
        body: qrCodeBuffer,
        headers: { 
          authorization: encodedAuthHeader,
          'Content-Type': 'image/png'
        }
      });
      
      console.log(`Response status: ${response.status}`);
      
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
      
      console.log(`QR code successfully uploaded to Blossom: ${result.url}`);
      return result.url;
    } catch (blossomError) {
      console.error('Detailed Blossom SDK error:', blossomError);
      if (blossomError instanceof Error) {
        console.error('SDK Error name:', blossomError.name);
        console.error('SDK Error message:', blossomError.message);
        console.error('SDK Error stack:', blossomError.stack);
      }
      throw new Error(`Blossom SDK upload failed: ${blossomError instanceof Error ? blossomError.message : String(blossomError)}`);
    }
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw error;
  }
}