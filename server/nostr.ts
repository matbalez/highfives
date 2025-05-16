import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import { generateQRCodeDataURL } from './qrcode-util';
import * as QRCode from 'qrcode';

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

    // Generate QR code as base64 data URL if lightning invoice is available
    let qrCodeBase64 = '';
    if (highFive.lightningInvoice) {
      try {
        // Generate QR code as data URL and extract the base64 part
        qrCodeBase64 = await QRCode.toDataURL(highFive.lightningInvoice, {
          type: 'image/png',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        console.log('QR code generated successfully');
      } catch (e) {
        console.error('Failed to generate QR code:', e);
      }
    }

    // Determine event kind based on whether we have an image
    const kind = 1; // Regular note

    // Create the content with or without the QR code
    const content = qrCodeBase64 
      ? formatHighFiveContentWithImage(highFive, qrCodeBase64) 
      : formatHighFiveContent(highFive);
    
    // Create an unsigned event
    const unsignedEvent: Event = {
      kind,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'], // Tag for filtering/indexing
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
        unsignedEvent.tags.push(['p', data as string]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }

    // Finalize the event (sign it)
    const signedEvent = finalizeEvent(unsignedEvent, hexKey as unknown as Uint8Array);

    // Publish to all configured relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one relay to accept the event
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
  } catch (error) {
    // Don't let Nostr errors affect the main application
    console.error('Error publishing to Nostr:', error);
  }
}

// Basic high five content without image
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
    'Scan the QR code to send Bitcoin:',
    '',
    '#highfives'
  ];

  return parts.join('\n');
}

// Format content with embedded base64 image using Markdown format
// Most Nostr clients render markdown and will display the image inline
function formatHighFiveContentWithImage(
  highFive: {
    recipient: string;
    reason: string;
    amount: number;
    sender?: string;
  },
  qrCodeBase64: string
): string {
  // Basic content
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
    'Scan this QR code to send Bitcoin:',
    '',
    // Embed the image directly using Markdown image format
    `![QR Code](${qrCodeBase64})`,
    '',
    '#highfives'
  ];

  return parts.join('\n');
}