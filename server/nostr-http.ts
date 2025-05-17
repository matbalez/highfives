import { SimplePool, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { uploadImageToNostrBuild } from './nostr-image-upload';
import { generateAndUploadQRCode } from './blossom-client';

// Use WebSocket polyfill for Node.js environment
if (typeof global !== 'undefined') {
  (global as any).WebSocket = WebSocket;
}

// List of Nostr relays to publish to
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Directory to store QR code images (for local fallback)
const QR_CODE_DIR = path.join(process.cwd(), 'public', 'qr-codes');

// Initialize Nostr connection pool
const pool = new SimplePool();

// Create QR code directory if it doesn't exist
if (!fs.existsSync(QR_CODE_DIR)) {
  fs.mkdirSync(QR_CODE_DIR, { recursive: true });
  console.log(`Created QR code directory: ${QR_CODE_DIR}`);
}
console.log(`Serving QR code images from ${QR_CODE_DIR}`);

// Generate a QR code image, upload to nostr.build, and return URL
// Generate a data URL for a QR code that can be directly embedded in Nostr posts
async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    // Generate QR code as data URL for direct embedding
    const dataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log('Generated QR code as data URL');
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    throw error;
  }
}

// Also save a local copy for reference
async function saveQRCodeLocally(data: string): Promise<string> {
  try {
    // Generate a unique filename
    const filename = `${crypto.randomUUID()}.png`;
    const filepath = path.join(QR_CODE_DIR, filename);
    
    // Generate the QR code as a PNG file locally
    await QRCode.toFile(filepath, data, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log(`Generated QR code image: ${filename}`);
    
    // Return the public URL
    return `/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error saving QR code locally:', error);
    throw error;
  }
}

// Publish a high five to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  sender?: string;
  lightningInvoice?: string;
}): Promise<void> {
  try {
    // Get private key from environment variables
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.error('Cannot publish to Nostr: NOSTR_PRIVATE_KEY is not set');
      return;
    }

    // Handle nsec format if needed
    let hexKey = privateKeyHex;
    if (typeof privateKeyHex === 'string' && privateKeyHex.startsWith('nsec')) {
      try {
        const { data } = nip19.decode(privateKeyHex);
        hexKey = data as string;
      } catch (e) {
        console.error('Invalid nsec key:', e);
        return;
      }
    }

    // Get public key from private key
    const publicKey = getPublicKey(hexKey as unknown as Uint8Array);
    console.log(`Publishing High Five to Nostr using public key: ${publicKey}`);

    // Default content without QR code
    const baseContent = formatHighFiveContent(highFive);

    // Create the base event
    const event: Event = {
      kind: 1, // Regular note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'],
      ],
      content: baseContent,
      id: '',
      sig: ''
    };

    // Add recipient tag if it looks like a npub
    if (highFive.recipient.startsWith('npub')) {
      try {
        const { data } = nip19.decode(highFive.recipient);
        event.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }
    
    // Add Lightning invoice and QR code to the Nostr post if available
    if (highFive.lightningInvoice) {
      try {
        console.log(`Adding Lightning invoice to Nostr post: ${highFive.lightningInvoice.substring(0, 15)}...`);

        // Save a local copy for display in our app (for our own UI)
        await saveQRCodeLocally(highFive.lightningInvoice);

        // For maximum compatibility, just include the full Lightning invoice text
        // in the content - keeping it simple with no images
        event.content += `\n\n## Pay with Bitcoin Lightning ⚡\n\n`;
        event.content += `\`${highFive.lightningInvoice}\``;
        
        // Add shortened Lightning invoice tags to avoid tag size limits
        // Instead of adding the full invoice in the tags, we'll just mention it's available in content
        event.tags.push(['lightning', 'See content for full invoice']);
        event.tags.push(['l', 'Lightning payment available']);
        
        console.log('Added Lightning invoice to Nostr post');
      } catch (err) {
        console.error('Error adding Lightning details to Nostr post:', err);
        
        // Fall back to just mentioning payment
        event.content += `\n\nScan QR code in the original High Five app to pay with Bitcoin Lightning.`;
      }
    }

    // Sign the event
    const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);
    
    // Log the event ID (this is what you'd use to find the event in a Nostr client)
    console.log(`Nostr event created with ID: ${signedEvent.id}`);
    console.log(`Nostr event public key: ${signedEvent.pubkey}`);
    console.log(`Nostr event tags:`, JSON.stringify(signedEvent.tags));
    
    // Log which relays we're publishing to
    console.log(`Publishing to Nostr relays: ${NOSTR_RELAYS.join(', ')}`);

    // Publish to relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Set up a more detailed success/failure tracking
    let successCount = 0;
    let failureCount = 0;
    
    // Track results from each relay
    const pubResults = pubs.map((pub, index) => 
      pub.then(() => {
        successCount++;
        console.log(`✅ Published to relay ${NOSTR_RELAYS[index]} successfully`);
        return { relay: NOSTR_RELAYS[index], success: true };
      }).catch(err => {
        failureCount++;
        console.error(`❌ Failed to publish to relay ${NOSTR_RELAYS[index]}:`, err);
        return { relay: NOSTR_RELAYS[index], success: false, error: err };
      })
    );
    
    // Wait for all publications to complete or fail
    try {
      const results = await Promise.allSettled(pubResults);
      
      // Log detailed results
      console.log(`Nostr publication complete: ${successCount} successes, ${failureCount} failures`);
      
      if (successCount > 0) {
        console.log(`High Five successfully published to Nostr with event ID: ${signedEvent.id}`);
        console.log(`Search for this event ID in Nostr clients or use https://nostr.watch/e/${signedEvent.id}`);
      } else {
        console.error(`Failed to publish High Five to any Nostr relay`);
      }
    } catch (error) {
      console.error('Error waiting for Nostr publications:', error);
    }
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
  }
}

// Format high five content
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    sender?: string;
  }
): string {
  // Format sender with nostr mention if it's an npub
  let senderDisplay = 'From: Anonymous';
  if (highFive.sender) {
    if (highFive.sender.startsWith('npub')) {
      // Format as a proper Nostr mention with npub only (clients will render with @)
      senderDisplay = `From: ${highFive.sender}`;
      
      // Add a log to track that we're adding Nostr mentions
      console.log(`Adding mention for sender: ${highFive.sender}`);
    } else {
      senderDisplay = `From: ${highFive.sender}`;
    }
  }
  
  // Format recipient with nostr mention if it's an npub
  let recipientDisplay = `To: ${highFive.recipient}`;
  if (highFive.recipient.startsWith('npub')) {
    // Format as a proper Nostr mention with npub only (clients will render with @)
    recipientDisplay = `To: ${highFive.recipient}`;
    
    // Add a log to track that we're adding Nostr mentions
    console.log(`Adding mention for recipient: ${highFive.recipient}`);
  }

  const parts = [
    `🖐️ High Five`,
    recipientDisplay,
    senderDisplay,
    '',
    highFive.reason,
    '',
    'Scan the QR code to send Bitcoin:',
    '',
    '#highfives'
  ];

  return parts.join('\n');
}