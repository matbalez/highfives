import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import { generateQRCodeDataURL } from './qrcode-util';

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
    const publicKey = getPublicKey(hexKey);
    console.log(`Publishing High Five to Nostr using public key: ${publicKey}`);

    // Generate QR code if lightning invoice is available
    let qrCodeDataURL = '';
    if (highFive.lightningInvoice) {
      try {
        qrCodeDataURL = await generateQRCodeDataURL(highFive.lightningInvoice);
        console.log('QR code generated successfully');
      } catch (e) {
        console.error('Failed to generate QR code:', e);
      }
    }

    // Format content based on available data
    const content = formatHighFiveContent(highFive, qrCodeDataURL);
    
    // Create an unsigned event
    const unsignedEvent: Event = {
      kind: 1, // Regular note
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

    // If we have a QR code, add it as an image tag (NIP-94)
    if (qrCodeDataURL) {
      unsignedEvent.tags.push(['image', qrCodeDataURL]);
    }

    // Finalize the event (sign it)
    const signedEvent = finalizeEvent(unsignedEvent, hexKey);

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

// Format high five content, possibly including QR code
function formatHighFiveContent(
  highFive: {
    recipient: string;
    reason: string;
    amount: number;
    sender?: string;
  },
  qrCodeDataURL?: string
): string {
  // Basic content
  const parts = [
    `🖐️ High Five of ${highFive.amount} sats`,
    `To: ${highFive.recipient}`,
    highFive.sender ? `From: ${highFive.sender}` : 'From: Anonymous',
    '',
    highFive.reason,
    '',
  ];

  // Add instructions for QR code if available
  if (qrCodeDataURL) {
    parts.push('');
    parts.push('Scan the QR code to send Bitcoin');
  }

  // Add hashtag
  parts.push('');
  parts.push('#highfives');

  return parts.join('\n');
}