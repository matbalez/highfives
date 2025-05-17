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

// Create high five note and publish to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
  lightningInvoice?: string;
  qrCodeUrl?: string;
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
    if (privateKeyHex.startsWith('nsec')) {
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

    // Format the basic content without the QR code image
    const content = formatHighFiveContent(highFive);
    
    // Generate QR code for the Lightning invoice
    let qrCodeImageUrl = '';
    if (highFive.lightningInvoice) {
      try {
        // Create directory for QR codes if it doesn't exist
        const publicDir = path.join(process.cwd(), 'public');
        const qrDir = path.join(publicDir, 'qr-codes');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        if (!fs.existsSync(qrDir)) {
          fs.mkdirSync(qrDir, { recursive: true });
        }
        
        // Generate a unique filename for the QR code
        const qrCodeFilename = `${crypto.randomUUID()}.png`;
        const qrCodePath = path.join(qrDir, qrCodeFilename);
        
        // Generate and save the QR code image file
        await QRCode.toFile(qrCodePath, highFive.lightningInvoice, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        // Create a URL to the QR code image file
        // We'll use a relative URL to make it work on any Replit URL
        qrCodeImageUrl = `/qr-codes/${qrCodeFilename}`;
        console.log(`Generated QR code image at: ${qrCodeImageUrl}`);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    }
    
    // Create a kind 1 event (text note) with image
    const nostrEvent: Event = {
      kind: 1, // Standard text note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'], 
        ['amount', highFive.amount.toString()]
      ],
      content,
      id: '',
      sig: '',
    };

    // Add recipient tag if it looks like a npub
    if (highFive.recipient.startsWith('npub')) {
      try {
        const { data } = nip19.decode(highFive.recipient);
        nostrEvent.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }

    // Add image tag according to NIP-10 and how most clients implement it
    if (qrCodeImageUrl) {
      // Generate the full URL using the current host
      const host = process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.replit.app` : 'localhost:5000';
      const protocol = 'https';
      const fullQrCodeUrl = `${protocol}://${host}${qrCodeImageUrl}`;
      console.log(`Full QR code URL: ${fullQrCodeUrl}`);
      
      // Primal and many clients understand this method (content with image URL)
      nostrEvent.content += `\n\n![QR Code](${fullQrCodeUrl})`;
      
      // Also include the standard Nostr image tags for various clients
      nostrEvent.tags.push(['url', fullQrCodeUrl]);
      nostrEvent.tags.push(['image', fullQrCodeUrl]);
      nostrEvent.tags.push(['img', fullQrCodeUrl]);
      nostrEvent.tags.push(['r', fullQrCodeUrl]);
    }

    // Finalize and sign the event
    const signedEvent = finalizeEvent(nostrEvent, hexKey as unknown as Uint8Array);
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one relay to accept the event
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
  }
}

// Basic high five content
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    amount: number;
    sender?: string;
  }
): string {
  // Basic content
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
    '👇👇👇',
    '',
    'Scan the QR code to send Bitcoin: ',
    '',
    '#highfives'
  ];

  return parts.join('\n');
}