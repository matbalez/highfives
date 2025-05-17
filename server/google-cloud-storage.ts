import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

// This class handles uploading QR code images to Google Cloud Storage
export class GoogleCloudStorage {
  private storage: Storage;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    // Check if required environment variables are set
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable must be set');
    }
    this.bucketName = bucketName;

    // Create Storage instance
    try {
      // If credentials provided via environment variable (preferred method)
      this.storage = new Storage();
      
      // Set the base URL for public access to the bucket
      this.publicUrl = `https://storage.googleapis.com/${this.bucketName}`;
    } catch (error) {
      console.error('Error initializing Google Cloud Storage:', error);
      throw error;
    }
  }

  // Upload a file to Google Cloud Storage
  async uploadFile(filePath: string): Promise<string> {
    try {
      // Generate a unique file name to avoid collisions
      const fileName = `qr-codes/${crypto.randomUUID()}-${path.basename(filePath)}`;
      
      // Upload the file to Google Cloud Storage
      await this.storage.bucket(this.bucketName).upload(filePath, {
        destination: fileName,
        // Make the file publicly readable
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      await this.storage.bucket(this.bucketName).file(fileName).makePublic();
      
      // Return the public URL to the uploaded file
      return `${this.publicUrl}/${fileName}`;
    } catch (error) {
      console.error('Error uploading file to Google Cloud Storage:', error);
      throw error;
    }
  }
}

// Helper function to upload a QR code image to Google Cloud Storage
export async function uploadQRCodeToGCS(filePath: string): Promise<string> {
  try {
    const googleStorage = new GoogleCloudStorage();
    return await googleStorage.uploadFile(filePath);
  } catch (error) {
    console.error('Error uploading QR code to Google Cloud Storage:', error);
    throw error;
  }
}