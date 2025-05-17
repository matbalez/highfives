import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Cloudflare API configuration
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_ACCESS_KEY = process.env.CF_ACCESS_KEY;
const CF_SECRET_KEY = process.env.CF_SECRET_KEY;
const CF_BUCKET_NAME = process.env.CF_BUCKET_NAME || 'highfives-qrcodes';
const CF_PUBLIC_URL = process.env.CF_PUBLIC_URL || '';

/**
 * Upload an image directly to Cloudflare Images
 * This is a simpler approach that works well for QR codes
 */
export async function uploadImageToCloudflare(filePath: string): Promise<string> {
  try {
    // Check if we have the necessary credentials
    if (!CF_ACCOUNT_ID || !CF_ACCESS_KEY) {
      throw new Error('Missing Cloudflare credentials');
    }
    
    console.log(`Preparing to upload image to Cloudflare: ${filePath}`);
    
    // Create a unique ID for the image
    const uniqueId = `qr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Create a FormData object for the image upload
    const formData = new FormData();
    const fileStream = fs.createReadStream(filePath);
    formData.append('file', fileStream);
    formData.append('id', uniqueId);
    
    // Upload URL for Cloudflare Images
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
    
    // Make the API request to upload the image
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_ACCESS_KEY}`
      },
      // @ts-ignore
      body: formData
    });
    
    // Parse the response
    const result = await response.json() as any;
    
    if (!result.success) {
      console.error('Cloudflare upload error:', result.errors);
      throw new Error(`Failed to upload image: ${JSON.stringify(result.errors)}`);
    }
    
    // Get the URL of the uploaded image
    const imageId = result.result.id;
    const imageUrl = `https://imagedelivery.net/${CF_ACCOUNT_ID}/${imageId}/public`;
    
    console.log(`Successfully uploaded image to Cloudflare: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading to Cloudflare:', error);
    throw error;
  }
}

/**
 * Upload a QR code image to a public URL
 * Uses Cloudflare with a fallback to local hosting
 */
export async function uploadQRCode(filePath: string, localBaseUrl: string = ''): Promise<string> {
  try {
    // First try to upload to Cloudflare
    return await uploadImageToCloudflare(filePath);
  } catch (error) {
    console.warn('Failed to upload QR code to Cloudflare, falling back to local URL:', error);
    
    // Get the filename and construct a local URL
    const fileName = path.basename(filePath);
    const localUrl = `${localBaseUrl}/qr-codes/${fileName}`;
    
    console.log(`Using local QR code URL: ${localUrl}`);
    return localUrl;
  }
}