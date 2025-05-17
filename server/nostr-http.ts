import { SimplePool, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { uploadImageToNostrBuild } from './nostr-image-upload';

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

        // Save a local copy for display in our app
        await saveQRCodeLocally(highFive.lightningInvoice);

        // For maximum compatibility, include the full Lightning invoice text
        // This allows wallets to detect and extract it directly
        event.content += `\n\n## Scan to pay with Bitcoin Lightning ⚡\n\n`;
        event.content += `\`${highFive.lightningInvoice}\``;
        
        // Add Lightning invoice tags that some clients recognize
        event.tags.push(['lightning', highFive.lightningInvoice]);
        event.tags.push(['l', highFive.lightningInvoice]);
        
        // Many Nostr clients will automatically generate QR codes from the invoice text
        // Some will even recognize the lightning: prefix and make it clickable
        // We don't need to add an image tag since the invoice itself is included
        
        console.log('Added Lightning invoice to Nostr post');
      } catch (err) {
        console.error('Error adding Lightning details to Nostr post:', err);
        
        // Fall back to just mentioning payment
        event.content += `\n\nScan QR code in the original High Five app to pay with Bitcoin Lightning.`;
      }
    }

    // Sign the event
    const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);

    // Publish to relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one successful publication
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
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
  const parts = [
    `🖐️ High Five`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
    'Scan the QR code to send Bitcoin:',
    '',
    '#highfives'
  ];

  return parts.join('\n');
}