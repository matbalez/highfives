import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

// Setup WebSocket for Node environment
if (typeof global !== 'undefined') {
  (global as any).WebSocket = WebSocket;
}

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Initialize Nostr connection pool
const pool = new SimplePool();

// Generate a QR code for a Lightning invoice
async function generateQRCode(data: string): Promise<Buffer> {
  // Create a temporary directory if it doesn't exist
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Generate a temporary filename
  const filename = path.join(tmpDir, `${crypto.randomUUID()}.png`);
  
  // Generate the QR code as a PNG file
  await QRCode.toFile(filename, data, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
  
  // Read the file into a buffer
  const buffer = fs.readFileSync(filename);
  
  // Clean up the temporary file
  fs.unlinkSync(filename);
  
  return buffer;
}

// Implementation of NIP-94 for file attachments
// See: https://github.com/nostr-protocol/nips/blob/master/94.md
async function publishFileEvent(
  privateKeyHex: string,
  fileData: Buffer,
  fileDescription: string,
  fileType: string = 'image/png',
  altText: string = ''
): Promise<string> {
  // Handle nsec format
  let hexKey = privateKeyHex;
  if (typeof privateKeyHex === 'string' && privateKeyHex.startsWith('nsec')) {
    try {
      const { data } = nip19.decode(privateKeyHex);
      hexKey = data as string;
    } catch (e) {
      console.error('Invalid nsec key:', e);
      throw e;
    }
  }
  
  // Get public key
  const pubkey = getPublicKey(hexKey as unknown as Uint8Array);
  
  // Convert file to base64
  const base64Data = fileData.toString('base64');
  
  // Create a file attachment event (kind: 1063) according to NIP-94
  const event: Event = {
    kind: 1063,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['alt', altText],
      ['m', fileType],
      ['size', fileData.length.toString()],
      ['dim', '300x300'],
      ['x', fileDescription]
    ],
    content: base64Data,
    id: '',
    sig: ''
  };

  // Sign the event
  const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);
  
  // Publish to relays
  const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
  await Promise.any(pubs);
  
  console.log(`Published file event with ID: ${signedEvent.id}`);
  
  return signedEvent.id;
}

// Create high five note and publish to Nostr with QR code
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
  lightningInvoice?: string;
}): Promise<void> {
  try {
    // Get the private key from environment variables
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

    // First, publish the QR code as a separate file event if we have a lightning invoice
    let qrCodeEventId = '';
    if (highFive.lightningInvoice) {
      // Generate QR code
      const qrCodeBuffer = await generateQRCode(highFive.lightningInvoice);
      
      // Publish QR code as a file event
      qrCodeEventId = await publishFileEvent(
        hexKey,
        qrCodeBuffer,
        'QR Code for Lightning Invoice',
        'image/png',
        'Scan this QR code to pay the Lightning invoice'
      );
      
      console.log(`Published QR code as event: ${qrCodeEventId}`);
    }
    
    // Format the content of the main post
    const content = formatHighFiveContent(highFive);
    
    // Create a kind 1 event (text note)
    const textEvent: Event = {
      kind: 1,
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
        textEvent.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }

    // Add reference to the QR code if we published one
    if (qrCodeEventId) {
      // This tag format works with most clients
      textEvent.tags.push(['e', qrCodeEventId, '', 'qr-code']);
    }

    // Finalize and send the main event
    const signedTextEvent = finalizeEvent(textEvent, hexKey as unknown as Uint8Array);
    const pubs = pool.publish(NOSTR_RELAYS, signedTextEvent);
    
    // Wait for at least one relay to accept the event
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
  }
}

// Format high five content
function formatHighFiveContent(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
}): string {
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
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