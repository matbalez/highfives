import { SimplePool, getEventHash, finalizeEvent, getPublicKey, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';

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

// Initialize Nostr connection pool
const pool = new SimplePool();

// Publish a high five to Nostr
export async function publishHighFiveToNostr(highFive: {
  recipient: string;
  reason: string;
  amount: number;
  sender?: string;
  lightningInvoice?: string;
}): Promise<void> {
  try {
    const privateKeyHex = process.env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.error('Cannot publish to Nostr: NOSTR_PRIVATE_KEY is not set');
      return;
    }

    // Convert nsec to hex if needed
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

    // Generate QR code as data URL if we have a lightning invoice
    let qrCodeDataUrl = '';
    if (highFive.lightningInvoice) {
      qrCodeDataUrl = await QRCode.toDataURL(highFive.lightningInvoice, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300
      });
      console.log('Generated QR code data URL');
    }

    // Create the content with QR code
    const content = formatHighFiveContent(highFive, qrCodeDataUrl);

    // Create the event
    const event: any = {
      kind: 1, // Regular text note
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'highfive'],
        ['amount', highFive.amount.toString()]
      ],
      content
    };

    // Add recipient tag if it's a npub
    if (highFive.recipient.startsWith('npub')) {
      try {
        const { data } = nip19.decode(highFive.recipient);
        event.tags.push(['p', data]);
      } catch (e) {
        console.error('Invalid npub recipient:', e);
      }
    }

    // Finalize (add ID and signature) the event
    const signedEvent = finalizeEvent(event, hexKey as unknown as Uint8Array);

    // Publish to all relays
    const pubs = pool.publish(NOSTR_RELAYS, signedEvent);
    
    // Wait for at least one successful publication
    await Promise.any(pubs);
    
    console.log('High Five successfully published to Nostr');
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
  }
}

// Format high five content with embedded QR code using nostr:nprofile tag
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    amount: number;
    sender?: string;
  },
  qrCodeDataUrl?: string
): string {
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason
  ];

  if (qrCodeDataUrl) {
    parts.push('');
    parts.push('Scan this QR code to send Bitcoin:');
    parts.push('');
    
    // Use Nostr Web Image protocol (data URL directly in content)
    parts.push(`nostr:image:${qrCodeDataUrl}`);
  }

  parts.push('');
  parts.push('#highfives');

  return parts.join('\n');
}