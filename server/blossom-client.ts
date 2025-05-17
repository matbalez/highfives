import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { BlossomClient } from 'blossom-client-sdk';
import { finalizeEvent, getEventHash, type EventTemplate, type UnsignedEvent } from 'nostr-tools';

// Define the Blossom server URL
const BLOSSOM_SERVER_URL = 'https://api.blossom.band';

// Generate a private key for signing the upload auth events if not provided in env
const blossomPrivateKey = process.env.BLOSSOM_PRIVATE_KEY || crypto.randomBytes(32).toString('hex');

// Create a signer function to use with BlossomClient
const nostrSigner = async (draft: EventTemplate) => {
  try {
    // Create an unsigned event with our private key
    const pubkey = crypto.createHash('sha256').update(blossomPrivateKey).digest('hex');
    const event: UnsignedEvent = { ...draft, pubkey };
    
    // Create a hash of the event to sign
    const id = getEventHash(event);
    
    // Sign the event (simplified version for this demo)
    const signedData = crypto.createHmac('sha256', blossomPrivateKey).update(id).digest('hex');
    
    // Return the signed event
    return { ...event, id, sig: signedData };
  } catch (error) {
    console.error('Error signing event:', error);
    throw error;
  }
};

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
      // Create a file object for the SDK
      const filename = `image-${crypto.randomUUID()}.png`;
      const fileDescription = `Image upload from High Fives App - ${new Date().toISOString()}`;
      
      // Create a temporary file to pass to the Blossom SDK
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tmpDir, filename);
      fs.writeFileSync(tempFilePath, imageBuffer);
      
      // Create a file object that looks like a browser file
      const file = {
        buffer: imageBuffer,
        name: filename,
        size: imageBuffer.length,
        type: mimeType,
        path: tempFilePath
      };
      
      console.log('Creating Blossom upload auth...');
      
      // Create upload auth event with our signer
      const uploadAuth = await BlossomClient.createUploadAuth(
        file,
        nostrSigner, 
        { message: fileDescription }
      );
      
      console.log('Created Blossom auth event successfully');
      
      // Manually do the upload to the server
      const result = await BlossomClient.uploadBlob(BLOSSOM_SERVER_URL, file, uploadAuth);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
      
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
    
    try {
      // Create a description for the QR code
      const fileDescription = `QR Code for Lightning Invoice - ${new Date().toISOString()}`;
      
      // Create a file-like object for the Blossom SDK
      const file = {
        buffer: qrCodeBuffer,
        name: filename,
        size: qrCodeBuffer.length,
        type: 'image/png',
        path: tempFilePath
      };
      
      console.log('Creating Blossom upload auth for QR code...');
      
      // Create upload auth event with our signer
      const uploadAuth = await BlossomClient.createUploadAuth(
        file,
        nostrSigner, 
        { message: fileDescription }
      );
      
      console.log('Created Blossom auth event successfully for QR code');
      
      // Upload the blob to the Blossom server
      const result = await BlossomClient.uploadBlob(BLOSSOM_SERVER_URL, file, uploadAuth);
      
      console.log(`Blossom upload response:`, result);
      
      // Extract URL
      if (!result || !result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      console.log(`QR code successfully uploaded to Blossom: ${result.url}`);
      return result.url;
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