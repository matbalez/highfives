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
  amount: number;
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
        ['amount', highFive.amount.toString()]
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
    amount: number;
    sender?: string;
  },
  qrCodeUrl: string = ''
): string {
  // Get the full public URL for the QR code
  const hostname = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.dev` : 'https://highfives.replit.app';
  const fullQrCodeUrl = qrCodeUrl ? `${hostname}${qrCodeUrl}` : '';
  
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason
  ];

  if (fullQrCodeUrl) {
    parts.push('');
    parts.push('Scan this QR code to send Bitcoin:');
    parts.push('');
    // Use a simple image link that all clients should support
    parts.push(`![QR Code](${fullQrCodeUrl})`);
  }

  parts.push('');
  parts.push('#highfives');

  return parts.join('\n');
}