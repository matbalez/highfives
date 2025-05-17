import { SimplePool, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

// Directory to store QR code images
const QR_CODE_DIR = path.join(process.cwd(), 'public', 'qr-codes');

// Initialize Nostr connection pool
const pool = new SimplePool();

// Create QR code directory if it doesn't exist
if (!fs.existsSync(QR_CODE_DIR)) {
  fs.mkdirSync(QR_CODE_DIR, { recursive: true });
  console.log(`Created QR code directory: ${QR_CODE_DIR}`);
}
console.log(`Serving QR code images from ${QR_CODE_DIR}`);

// Generate a QR code image and save it to public directory
async function generateQRCodeImage(data: string): Promise<string> {
  // Generate a unique filename
  const filename = `${crypto.randomUUID()}.png`;
  const filepath = path.join(QR_CODE_DIR, filename);
  
  // Generate the QR code as a PNG file
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
  
  // Return the public URL
  return `/qr-codes/${filename}`;
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

    // Generate QR code image if we have a lightning invoice
    let qrCodeUrl = '';
    if (highFive.lightningInvoice) {
      qrCodeUrl = await generateQRCodeImage(highFive.lightningInvoice);
      console.log(`Generated QR code image: ${qrCodeUrl}`);
    }

    // Format high five content with the QR code URL
    const content = formatHighFiveContent(highFive, qrCodeUrl);

    // Create an event
    const event: Event = {
      kind: 1, // Regular note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'],
      ],
      content,
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
    
    // Add QR code image to the Nostr post
    if (highFive.lightningInvoice && qrCodeUrl) {
      try {
        // Extract the QR code filename from the URL path
        const qrCodeFilename = path.basename(qrCodeUrl);
        const qrCodeFilePath = path.join(QR_CODE_DIR, qrCodeFilename);
        
        // Log what we're doing (without the full base64 content)
        console.log(`Using QR code image from: ${qrCodeFilePath}`);
        
        // Read the QR code image file directly
        const qrCodeBuffer = fs.readFileSync(qrCodeFilePath);
        
        // Convert to base64 for embedding directly in the Nostr post
        const base64Image = qrCodeBuffer.toString('base64');
        
        // Create a separate Nostr event specifically for the image (kind 1063 - file attachment)
        // This follows NIP-94 for file attachments in Nostr
        const imageEvent = {
          kind: 1063, // File attachment kind
          pubkey: publicKey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['alt', 'QR Code for Lightning payment'],
            ['m', 'image/png'],
            ['size', qrCodeBuffer.length.toString()],
            ['dim', '300x300'],
            ['blurhash', 'LRN%NmxutRofIVayt7ay00WB~qWB']
          ],
          content: base64Image,
          id: '',
          sig: ''
        };
        
        // Sign and publish the image event
        const signedImageEvent = finalizeEvent(imageEvent, hexKey as unknown as Uint8Array);
        await pool.publish(NOSTR_RELAYS, signedImageEvent);
        
        console.log('Published QR code as a separate Nostr image event');
        
        // Now reference the image in the main event using NIP-94 format
        event.tags.push(['e', signedImageEvent.id, '', 'image']);
        
        // Also add as a Markdown image in the content for clients that don't support NIP-94
        // But first create a small preview of the base64 data to avoid flooding logs
        const base64Preview = base64Image.substring(0, 20) + '...';
        console.log(`Adding image to Nostr post (base64 preview: ${base64Preview})`);
        
        // Add a note about the QR code being attached
        event.content += '\n\nA QR code for Bitcoin payment is attached to this post.';
      } catch (err) {
        console.error('Error attaching QR code to Nostr post:', err);
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

// Format high five content with QR code URL
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    sender?: string;
  },
  qrCodeUrl: string = ''
): string {
  // Get the full public URL for the QR code
  const hostname = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.dev` : 'https://highfives.replit.app';
  const fullQrCodeUrl = qrCodeUrl ? `${hostname}${qrCodeUrl}` : '';
  
  const parts = [
    `🖐️ High Five`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
    'Scan the QR code to send Bitcoin:',
  ];

  // The fullQrCodeUrl will be referenced in the 'i' tag instead of in the content
  
  parts.push('');
  parts.push('#highfives');

  return parts.join('\n');
}