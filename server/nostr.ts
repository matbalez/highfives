import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import { generateQRCodeDataURL } from './qrcode-util';
import * as QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
      sig: '',
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

    // Use NIP-57 compatible Lightning zap tags
    if (highFive.lightningInvoice) {
      // Add proper zap tags for Lightning invoice
      textEvent.tags.push(['zap', '']);
      textEvent.tags.push(['bolt11', highFive.lightningInvoice]);
      
      // Add the raw invoice text directly to the content for clients to render as QR code
      const invoiceSection = [
        '',
        'Lightning Payment:',
        '',
        highFive.lightningInvoice
      ];
      textEvent.content += invoiceSection.join('\n');
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
    'Scan this QR code to send Bitcoin:',
    '',
    '#highfives'
  ];

  return parts.join('\n');
}