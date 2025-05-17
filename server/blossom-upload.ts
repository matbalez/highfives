import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// Blossom API endpoint for uploads - FIXING URL FORMAT
const BLOSSOM_UPLOAD_URL = 'https://api.blossom.band/v1/upload';

/**
 * Uploads an image to Blossom service
 * @param filePath Path to the local image file to upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImageToBlossom(filePath: string): Promise<string> {
  try {
    // Create form data for file upload
    const formData = new FormData();
    
    // Add the file to form data
    formData.append('file', fs.createReadStream(filePath));
    
    // Check if API key is available
    const apiKey = process.env.BLOSSOM_API_KEY;
    if (apiKey) {
      formData.append('api_key', apiKey);
    }
    
    // Upload to Blossom API
    const response = await fetch(BLOSSOM_UPLOAD_URL, {
      method: 'POST',
      body: formData as any,
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blossom upload failed with status: ${response.status}, response: ${errorText}`);
    }
    
    const result = await response.json() as any;
    
    // Check for success and extract URL
    if (result && result.success && result.url) {
      console.log('Successfully uploaded image to Blossom:', result.url);
      return result.url;
    }
    
    throw new Error('No valid URL returned from Blossom upload service');
  } catch (error) {
    console.error('Error uploading image to Blossom:', error);
    throw error;
  }
}

/**
 * Creates a QR code image file and uploads it to Blossom
 * @param qrCodeBuffer Buffer containing the QR code image data
 * @returns Promise resolving to the URL of the uploaded QR code
 */
export async function uploadQRCodeToBlossom(qrCodeBuffer: Buffer): Promise<string> {
  try {
    // Create a temporary directory if it doesn't exist
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Generate a temporary filename
    const filename = path.join(tmpDir, `qrcode-${crypto.randomUUID()}.png`);
    
    // Write the buffer to a file
    fs.writeFileSync(filename, qrCodeBuffer);
    
    try {
      // Upload to Blossom
      const url = await uploadImageToBlossom(filename);
      return url;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
    }
  } catch (error) {
    console.error('Error uploading QR code to Blossom:', error);
    throw error;
  }
}

/**
 * Generic function to upload an image, with fallbacks
 * First tries Blossom, then falls back to other services
 * @param filePath Path to the local image file to upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function uploadImage(filePath: string): Promise<string> {
  try {
    // Try Blossom first
    return await uploadImageToBlossom(filePath);
  } catch (blossomError) {
    console.error('Failed to upload to Blossom, trying alternative services', blossomError);
    
    // Import from other file to avoid circular dependencies
    const { uploadImageToNostrBuild, uploadImageToImgBB } = await import('./nostr-image-upload');
    
    // Try nostr.build as fallback
    try {
      return await uploadImageToNostrBuild(filePath);
    } catch (nostrBuildError) {
      console.error('Failed to upload to nostr.build, trying another fallback service', nostrBuildError);
      
      // If ImgBB API key is available, try that as a second fallback
      const imgbbApiKey = process.env.IMGBB_API_KEY;
      if (imgbbApiKey) {
        return await uploadImageToImgBB(filePath, imgbbApiKey);
      }
      
      // If all fails, throw the original error
      throw blossomError;
    }
  }
}