import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Function to upload a QR code to a publicly accessible URL
// Uses Cloudflare R2 if credentials are available, or falls back to local hosting
export async function uploadQRCodeImage(filePath: string, localBaseUrl: string = ''): Promise<string> {
  try {
    // Try Cloudflare Direct Upload first
    const cloudflareUrl = await uploadToCloudflareR2(filePath);
    console.log(`Successfully uploaded QR code to Cloudflare: ${cloudflareUrl}`);
    return cloudflareUrl;
  } catch (error) {
    console.warn(`Cloudflare upload failed: ${error.message}, using local URL`);
    
    // Fall back to local hosting if Cloudflare upload fails
    const fileName = path.basename(filePath);
    const localUrl = `${localBaseUrl}/qr-codes/${fileName}`;
    console.log(`Using local URL for QR code: ${localUrl}`);
    return localUrl;
  }
}

// Function to upload directly to Cloudflare R2
async function uploadToCloudflareR2(filePath: string): Promise<string> {
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_ACCESS_KEY = process.env.CF_ACCESS_KEY;
  const CF_SECRET_KEY = process.env.CF_SECRET_KEY;
  const CF_BUCKET_NAME = process.env.CF_BUCKET_NAME;
  const CF_PUBLIC_URL = process.env.CF_PUBLIC_URL;
  
  // Validate that all required environment variables are set
  if (!CF_ACCOUNT_ID || !CF_ACCESS_KEY || !CF_SECRET_KEY || !CF_BUCKET_NAME || !CF_PUBLIC_URL) {
    throw new Error('Missing required Cloudflare credentials');
  }
  
  console.log('Preparing to upload QR code to Cloudflare R2...');
  
  // Create a unique key for the object
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(4).toString('hex');
  const fileName = path.basename(filePath);
  const objectKey = `qrcodes/${timestamp}-${randomId}-${fileName}`;
  
  // Read the file content
  const fileContent = fs.readFileSync(filePath);
  
  // Create a direct upload URL
  const createUploadUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_BUCKET_NAME}/direct_upload/urls`;
  const createResponse = await fetch(createUploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Email': CF_ACCESS_KEY,
      'X-Auth-Key': CF_SECRET_KEY
    },
    body: JSON.stringify({
      name: objectKey
    })
  });
  
  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to get upload URL: ${createResponse.status} ${errorText}`);
  }
  
  const uploadInfo = await createResponse.json() as any;
  
  if (!uploadInfo.success) {
    throw new Error(`Failed to create upload URL: ${JSON.stringify(uploadInfo.errors)}`);
  }
  
  const uploadUrl = uploadInfo.result.uploadURL;
  
  // Upload the file directly to the pre-signed URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png'
    },
    body: fileContent
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${uploadResponse.status} ${errorText}`);
  }
  
  // Return the public URL
  return `${CF_PUBLIC_URL}/${objectKey}`;
}