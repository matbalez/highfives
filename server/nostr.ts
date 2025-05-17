import { SimplePool, getEventHash, getPublicKey, finalizeEvent, nip19, type Event } from 'nostr-tools';
import WebSocket from 'ws';
import * as QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { createReadStream } from 'fs';

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
    
    // Generate QR code directly as base64 data URI for embedding in Nostr post
    let qrCodeBase64 = '';
    if (highFive.lightningInvoice) {
      try {
        // Generate QR code directly as a base64 data URI (inline image)
        qrCodeBase64 = await QRCode.toDataURL(highFive.lightningInvoice, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        console.log('Generated QR code as base64 data URI');
        
        // Remove the data:image/png;base64, part to get just the base64 content
        const base64Content = qrCodeBase64.replace(/^data:image\/png;base64,/, '');
        
        // Create a separate Nostr event specifically for the image (kind 1063 - direct image)
        // This is the recommended way to attach images in Nostr
        const imageEvent: Event = {
          kind: 1063, // Nostr image kind
          pubkey: publicKey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['alt', 'QR Code for Lightning payment'],
            ['m', 'image/png'],
            ['x', 'attachment']
          ],
          content: base64Content,
          id: '',
          sig: '',
        };
        
        // Sign and publish the image event first
        const signedImageEvent = finalizeEvent(imageEvent, hexKey as unknown as Uint8Array);
        await pool.publish(NOSTR_RELAYS, signedImageEvent);
        console.log('Published QR code image as a separate Nostr event');
        
        // Save the event ID to reference in the main high five post
        const imageEventId = signedImageEvent.id;
        
        // Generate a NIP-23 compliant image URL scheme that Primal understands
        qrCodeBase64 = `nostr:${imageEventId}`;
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

    // Add image tags based on the published image event
    if (qrCodeBase64 && qrCodeBase64.startsWith('nostr:')) {
      // Extract the event ID
      const imageEventId = qrCodeBase64.replace('nostr:', '');
      console.log(`Referencing QR code image event: ${imageEventId}`);
      
      // Add standard Nostr image reference tags
      // These are the tags that Primal and most clients recognize
      nostrEvent.tags.push(['e', imageEventId, '', 'image']);
      
      // For maximum compatibility with all Nostr clients
      nostrEvent.tags.push(['imeta', imageEventId, 'image/png', 'QR Code for Lightning payment']); 
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