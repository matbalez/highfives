import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { BlossomClient } from 'blossom-client-sdk';
import { finalizeEvent, getEventHash, type Event, type EventTemplate } from 'nostr-tools';

// Define the Blossom API endpoint
const BLOSSOM_SERVER = 'https://api.blossom.band';
const BLOSSOM_UPLOAD_ENDPOINT = new URL('/v1/upload', BLOSSOM_SERVER).toString();

/**
 * Creates a simple signer function for Nostr events
 * @returns A function that signs Nostr events
 */
function createNostrSigner() {
  // Get the private key from environment variables
  const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error('NOSTR_PRIVATE_KEY is not set in environment variables');
  }
  
  // The signer function that will sign Nostr events
  return async (draft: EventTemplate): Promise<Event> => {
    // Add the pubkey to the event
    const event = {
      ...draft,
      pubkey: '',  // Will be derived from private key if available
      created_at: Math.floor(Date.now() / 1000),
    };
    
    try {
      // Finalize the event with the private key
      const signedEvent = finalizeEvent(event, privateKeyHex);
      return signedEvent;
    } catch (error) {
      console.error('Failed to sign Nostr event:', error);
      throw error;
    }
  };
}

/**
 * Uploads an image to Blossom service using the Blossom SDK
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
      // Create a signer for Nostr authentication
      const signer = createNostrSigner();
      
      // Create an upload auth event
      const uploadAuthEvent = await BlossomClient.createUploadAuth(
        signer,
        BLOSSOM_SERVER,
        "Upload QR code image"
      );
      
      // Encode the authorization header
      const encodedAuthHeader = BlossomClient.encodeAuthorizationHeader(uploadAuthEvent);
      
      console.log('Successfully created Blossom upload auth');
      
      // Make the request to Blossom directly
      const response = await fetch(new URL("/v1/upload", BLOSSOM_SERVER), {
        method: "PUT",
        body: imageBuffer,
        headers: { 
          authorization: encodedAuthHeader,
          'content-type': mimeType
        },
      });
      
      // Log the response status
      console.log(`Blossom API response status: ${response.status}`);
      
      // Check if the upload was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blossom API responded with status ${response.status}: ${errorText}`);
      }
      
      // Parse the response
      const result = await response.json() as any;
      console.log('Blossom API response:', JSON.stringify(result));
      
      // Check for URL
      if (!result) {
        throw new Error('Blossom upload failed: Empty response');
      }
      
      if (!result.url) {
        throw new Error('Blossom upload failed: Missing URL in response');
      }
      
      // Return the URL of the uploaded image
      console.log('Blossom upload successful, image URL:', result.url);
      return result.url;
    } catch (blossomError) {
      console.error('Error with Blossom upload using SDK:', blossomError);
      throw blossomError;
    }
  } catch (error) {
    console.error('Error uploading to Blossom:', error);
    
    // Additional error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw new Error(`Failed to upload image to Blossom: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a QR code PNG image and uploads it to Blossom API using the SDK
 * @param data The string data to encode in the QR code
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function generateAndUploadQRCode(data: string): Promise<string> {
  try {
    console.log('Starting QR code generation process for Lightning invoice...');
    
    // Generate QR code as PNG buffer
    const qrCodeBuffer = await new Promise<Buffer>((resolve, reject) => {
      QRCode.toBuffer(data, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    
    console.log(`Generated QR code buffer size: ${qrCodeBuffer.length} bytes`);
    
    // Upload the QR code to Blossom using our updated function
    const imageUrl = await uploadImageToBlossom(qrCodeBuffer, 'image/png');
    console.log(`QR code successfully uploaded to Blossom: ${imageUrl}`);
    
    return imageUrl;
  } catch (error) {
    console.error('Error generating or uploading QR code:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}