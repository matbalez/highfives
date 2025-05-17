import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cloudflare R2 configuration from environment variables
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_ACCESS_KEY = process.env.CF_ACCESS_KEY;
const CF_SECRET_KEY = process.env.CF_SECRET_KEY;
const CF_BUCKET_NAME = process.env.CF_BUCKET_NAME || 'highfives-qrcodes';
const CF_PUBLIC_URL = process.env.CF_PUBLIC_URL || 'https://pub-ed2d94e97f664a2ca2b0c7cdea3c11ad.r2.dev';

/**
 * Upload a file directly to Cloudflare R2 storage
 * Uses the Cloudflare R2 API to upload files and make them publicly accessible
 */
export async function uploadToCloudflare(filePath: string): Promise<string> {
  // Verify that all required credentials are available
  if (!CF_ACCOUNT_ID || !CF_ACCESS_KEY || !CF_SECRET_KEY || !CF_PUBLIC_URL) {
    throw new Error('Cloudflare credentials missing. Please check your environment variables.');
  }
  
  try {
    console.log(`Preparing to upload file to Cloudflare: ${filePath}`);
    
    // Read the file
    const fileContent = fs.readFileSync(filePath);
    const fileSize = fileContent.length;
    const fileName = path.basename(filePath);
    
    // Create a unique object key with timestamp to prevent collisions
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(6).toString('hex');
    const objectKey = `qrcodes/${timestamp}-${randomStr}-${fileName}`;
    
    console.log(`Uploading to Cloudflare R2 with key: ${objectKey}`);
    
    // For simplicity, we'll use the direct upload API for small files
    // This is a simplified approach that works for QR code images which are small
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_BUCKET_NAME}/objects/${objectKey}`;
    
    // Upload the file directly to R2 using the Cloudflare API
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': fileSize.toString(),
        'X-Auth-Key': CF_SECRET_KEY, 
        'X-Auth-Email': CF_ACCESS_KEY
      },
      body: fileContent
    });
    
    // Check if the upload was successful
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error uploading to Cloudflare: ${response.status} ${errorText}`);
    }
    
    // Return the public URL where the file can be accessed
    return `${CF_PUBLIC_URL}/${objectKey}`;
  } catch (error) {
    console.error('Error uploading to Cloudflare R2:', error);
    throw error;
  }
}

/**
 * Upload a QR code image to a public hosting service
 * Attempts to use Cloudflare R2, with fallback to local hosting
 */
export async function uploadQRCode(filePath: string, localUrlBase: string = ''): Promise<string> {
  try {
    console.log('Attempting to upload QR code to Cloudflare R2...');
    // First try to upload to Cloudflare
    const publicUrl = await uploadToCloudflare(filePath);
    console.log(`Successfully uploaded QR code to Cloudflare: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    // If Cloudflare upload fails, log the error and fall back to local URL
    console.warn('Failed to upload QR code to Cloudflare, using local URL instead', error);
    
    // Return a local URL that points to our own server
    const fileName = path.basename(filePath);
    const localUrl = `${localUrlBase}/qr-codes/${fileName}`;
    console.log(`Using local URL for QR code: ${localUrl}`);
    return localUrl;
  }
}