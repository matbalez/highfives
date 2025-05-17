import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { createReadStream } from 'fs';
import { generateAndUploadQRCode } from './blossom-client';

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
    
    // For storing QR code image reference
    let qrCodeUrl = '';
    if (highFive.lightningInvoice) {
      try {
        // Upload QR code to Blossom and get the URL
        qrCodeUrl = await generateAndUploadQRCode(highFive.lightningInvoice);
        
        if (qrCodeUrl) {
          console.log('QR code uploaded to Blossom successfully, URL:', qrCodeUrl);
        } else {
          // Fallback to base64 encoding if Blossom upload fails
          console.log('Blossom upload failed. Falling back to base64 QR code');
          qrCodeUrl = await QRCode.toDataURL(highFive.lightningInvoice, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
        }
      } catch (err) {
        console.error('Error generating or uploading QR code:', err);
        
        // Try to fall back to data URL if Blossom upload fails
        try {
          qrCodeUrl = await QRCode.toDataURL(highFive.lightningInvoice, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
          });
          console.log('Generated QR code as fallback data URL');
        } catch (fallbackErr) {
          console.error('Even fallback QR code generation failed:', fallbackErr);
        }
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

    // Add image reference if we have a QR code URL from Blossom
    if (qrCodeUrl) {
      if (qrCodeUrl.startsWith('http')) {
        // This is a Blossom URL, add it as an image URL tag
        console.log(`Adding Blossom QR code image URL to Nostr post: ${qrCodeUrl}`);
        
        // Add standard image URL tag that most clients will recognize
        nostrEvent.tags.push(['image', qrCodeUrl]);
        
        // For older clients that look for r and url tags
        nostrEvent.tags.push(['r', qrCodeUrl]);
        
        // Some clients use this format
        nostrEvent.tags.push(['picture', qrCodeUrl]);
        
        // Add alt text for accessibility
        nostrEvent.tags.push(['alt', 'QR Code for Bitcoin Lightning payment']);
      } else if (qrCodeUrl.startsWith('data:image')) {
        // This is a base64 data URL fallback, embed it differently
        console.log('Adding fallback base64 QR code to Nostr post');
        
        // Some clients support direct image embedding - we'll add a placeholder text
        nostrEvent.content += '\n\n[QR code for payment attached - scan with your Lightning wallet]';
      }
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