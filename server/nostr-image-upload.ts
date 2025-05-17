import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Upload an image to the nostr.build service, which is widely used by Nostr clients
export async function uploadImageToNostrBuild(filePath: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('fileToUpload', fs.createReadStream(filePath));
    
    // Upload to nostr.build API
    const response = await fetch('https://nostr.build/api/v2/upload/files', {
      method: 'POST',
      body: formData as any,
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    const result = await response.json() as any;
    
    // nostr.build returns an array of URLs for uploaded files
    if (result && result.data && result.data.length > 0) {
      return result.data[0]; // Return the first image URL
    }
    
    throw new Error('No valid URL returned from upload service');
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

// Alternative implementation using imgbb.com which also works well with Nostr
export async function uploadImageToImgBB(filePath: string, apiKey: string): Promise<string> {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Image);
    
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData as any,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    const result = await response.json() as any;
    
    if (result && result.data && result.data.url) {
      return result.data.url;
    }
    
    throw new Error('No valid URL returned from ImgBB');
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    throw error;
  }
}

// Generic function to determine the best upload service to use
export async function uploadImage(filePath: string): Promise<string> {
  // Default to nostr.build as it doesn't require an API key
  try {
    return await uploadImageToNostrBuild(filePath);
  } catch (error) {
    console.error('Failed to upload to nostr.build, trying fallback service');
    
    // If ImgBB API key is available, try that as a fallback
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    if (imgbbApiKey) {
      return await uploadImageToImgBB(filePath, imgbbApiKey);
    }
    
    // If all fails, throw the original error
    throw error;
  }
}