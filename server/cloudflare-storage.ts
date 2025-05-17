import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Define the base URL for Cloudflare direct upload
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_ACCESS_KEY = process.env.CF_ACCESS_KEY;
const CF_SECRET_KEY = process.env.CF_SECRET_KEY;
const CF_BUCKET_NAME = process.env.CF_BUCKET_NAME || 'highfives-qrcodes';
const CF_PUBLIC_URL = process.env.CF_PUBLIC_URL || 'https://pub-ed2d94e97f664a2ca2b0c7cdea3c11ad.r2.dev';

/**
 * Upload a file to Cloudflare R2 Storage
 * @param filePath Path to the local file
 * @returns Public URL to the uploaded file
 */
export async function uploadToCloudflare(filePath: string): Promise<string> {
  // Check if Cloudflare credentials are available
  if (!CF_ACCOUNT_ID || !CF_ACCESS_KEY || !CF_SECRET_KEY) {
    throw new Error('Cloudflare credentials not configured. Please set CF_ACCOUNT_ID, CF_ACCESS_KEY, and CF_SECRET_KEY.');
  }
  
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Generate a unique object key based on timestamp and random string
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');
    const objectKey = `${timestamp}-${randomStr}-${fileName}`;
    
    // Use Direct Upload API for R2
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_BUCKET_NAME}/direct_upload`;
    
    // Request an upload URL from Cloudflare
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_ACCESS_KEY}:${CF_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: objectKey,
        expiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry for the upload URL
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get upload URL: ${response.status} ${errorText}`);
    }
    
    const uploadInfo = await response.json() as any;
    
    // Use the one-time upload URL to upload the file
    const uploadResult = await fetch(uploadInfo.result.uploadURL, {
      method: 'PUT',
      body: fileContent,
      headers: {
        'Content-Type': 'image/png'
      }
    });
    
    if (!uploadResult.ok) {
      throw new Error(`Failed to upload file: ${uploadResult.status}`);
    }
    
    // Return the public URL to the file
    return `${CF_PUBLIC_URL}/${objectKey}`;
  } catch (error) {
    console.error('Error uploading to Cloudflare:', error);
    throw error;
  }
}

/**
 * Upload a QR code image to make it publicly accessible
 * Falls back to local URL if Cloudflare upload fails
 */
export async function uploadQRCode(filePath: string, localUrlBase: string = ''): Promise<string> {
  try {
    // Try to upload to Cloudflare
    return await uploadToCloudflare(filePath);
  } catch (error) {
    // Log the error but continue with a local URL
    console.warn('Failed to upload to Cloudflare, falling back to local URL:', error);
    
    // Return a local URL as fallback
    const fileName = path.basename(filePath);
    return `${localUrlBase}/qr-codes/${fileName}`;
  }
}