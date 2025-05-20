import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr, saveQRCodeLocally } from "./nostr-http";
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { lookupPaymentInstructions } from "./dns-util";
import { getLightningAddressFromNpub, getProfileNameFromNpub } from "./nostr-profile";
import { getLnurlFromLightningAddress, getInvoiceFromLightningAddress } from "./lightning-tool";

// Create public directory and qr-codes subdirectory if they don't exist
const publicDir = path.join(process.cwd(), 'public');
const qrCodesDir = path.join(publicDir, 'qr-codes');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(qrCodesDir)) {
  fs.mkdirSync(qrCodesDir, { recursive: true });
}

import { sendNostrDM } from './nostr-dm';

/**
 * Combined endpoint that tries both DNS lookup and Lightning invoice generation
 * First attempts DNS lookup for BIP-353 ₿tag
 * If that fails, tries generating invoice directly as Lightning Address
 */
async function getCombinedPaymentInstructions(address: string): Promise<{
  paymentInstructions: string;
  paymentType?: string;
  lightningAddress?: string;
} | null> {
  // First try as a BIP-353 tag
  try {
    const paymentInstructions = await lookupPaymentInstructions(address);
    if (paymentInstructions) {
      return {
        paymentInstructions,
        paymentType: 'bolt11',
        lightningAddress: address
      };
    }
  } catch (error) {
    console.log(`DNS lookup failed for ${address}: ${error.message}`);
    // If DNS lookup fails, continue to try Lightning Address
  }
  
  // If DNS lookup fails, try as a Lightning Address
  try {
    const invoice = await getInvoiceFromLightningAddress(address, 21000);
    if (invoice) {
      return {
        paymentInstructions: invoice,
        paymentType: 'bolt11',
        lightningAddress: address
      };
    }
  } catch (error) {
    console.log(`Lightning Address invoice generation failed for ${address}: ${error.message}`);
  }
  
  // Both methods failed
  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for high fives
  app.post("/api/high-fives", async (req, res) => {
    try {
      const validation = insertHighFiveSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validation.error.errors,
        });
      }
      
      // Include the profile name if provided
      const profileName = req.body.profileName as string | undefined;
      
      // Look up sender profile name if sender is an npub
      let senderProfileName: string | undefined;
      if (validation.data.sender && validation.data.sender.startsWith('npub')) {
        const profileName = await getProfileNameFromNpub(validation.data.sender);
        senderProfileName = profileName || undefined;
        console.log(`Found sender profile name: ${senderProfileName || 'None'}`);
      }
      
      const highFive = await storage.createHighFive({
        ...validation.data,
        profileName,
        senderProfileName
      });
      
      // Get Lightning invoice from request body if available
      const lightningInvoice = req.body.lightningInvoice as string | undefined;

      // Generate and save QR code for any high five
      let qrCodePath = null;
      if (lightningInvoice) {
        try {
          // Save QR code locally and get the path
          const localQrPath = await saveQRCodeLocally(lightningInvoice);
          if (localQrPath) {
            qrCodePath = localQrPath;
            console.log(`Saved QR code for high five ${highFive.id} at ${qrCodePath}`);
            
            // Update the high five with QR code path
            const updatedWithQr = await storage.updateHighFiveQRCodePath(highFive.id, qrCodePath);
            if (updatedWithQr) {
              highFive.qrCodePath = qrCodePath;
            }
          }
        } catch (err) {
          console.error('Error saving QR code:', err);
        }
      }
        
      // Only proceed with Nostr publication if we have a valid lightning invoice
      if (lightningInvoice) {
        console.log('Using payment instruction for Nostr publication:', { 
          type: 'from DNS lookup',
          preview: lightningInvoice.substring(0, 30) + '...'
        });

        try {
          // Publish to Nostr and wait for the result
          const nostrEventId = await publishHighFiveToNostr({
            recipient: validation.data.recipient,
            reason: validation.data.reason,
            sender: validation.data.sender || undefined,
            lightningInvoice: lightningInvoice
          });
          
          // Update the high five with the Nostr event ID
          if (nostrEventId) {
            // Use our new update method to store the Nostr event ID in the database
            const updatedHighFive = await storage.updateHighFiveNostrEventId(highFive.id, nostrEventId);
            if (updatedHighFive) {
              highFive.nostrEventId = nostrEventId;
              console.log(`Updated high five ${highFive.id} with Nostr event ID: ${nostrEventId}`);
            }
          }
          
          // Add the Nostr event ID and QR code path to the response
          return res.status(201).json({
            ...highFive,
            nostrEventId: nostrEventId,
            qrCodePath: highFive.qrCodePath || null,
            senderProfileName: highFive.senderProfileName
          });
        } catch (error) {
          // Log error but don't affect the main flow
          console.error('Error publishing to Nostr:', error);
          // Return the high five data without the Nostr event ID
          return res.status(201).json(highFive);
        }
      } else {
        console.log('Skipping Nostr publication due to missing payment instruction');
        return res.status(201).json(highFive);
      }
    } catch (error) {
      console.error("Error creating high five:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/high-fives", async (req, res) => {
    try {
      const highFives = await storage.getAllHighFives();
      return res.status(200).json(highFives);
    } catch (error) {
      console.error("Error fetching high fives:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint for generating a Lightning invoice directly from a Lightning Address
  app.get("/api/lightning-invoice", async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ 
          message: "Missing or invalid 'address' parameter",
          details: "Please provide a valid Lightning Address in the format user@domain.com" 
        });
      }
      
      if (!address.includes('@')) {
        return res.status(400).json({
          message: "Invalid Lightning Address format",
          details: "Lightning Address must be in the format user@domain.com"
        });
      }
      
      console.log(`Generating invoice for Lightning Address: ${address}`);
      
      // Generate an actual Lightning invoice using the @getalby/lightning-tools library
      const amount = 21000; // 21,000 sats for the High Five
      const comment = "High Five Payment";
      const invoice = await getInvoiceFromLightningAddress(address, amount, comment);
      
      if (!invoice) {
        console.log(`Failed to generate invoice for Lightning Address: ${address}`);
        return res.status(404).json({
          message: "Payment generation failed",
          details: "Could not generate a Lightning invoice for this address"
        });
      }
      
      console.log(`Successfully generated invoice for ${address}`);
      
      return res.status(200).json({
        paymentInstructions: invoice,
        paymentType: 'bolt11',
        lightningAddress: address
      });
    } catch (error) {
      console.error("Error generating Lightning invoice:", error);
      return res.status(500).json({ 
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint for looking up payment instructions from btag or npub
  app.get("/api/payment-instructions", async (req, res) => {
    try {
      // Check for either btag or npub parameter
      const btag = req.query.btag as string | undefined;
      const npub = req.query.npub as string | undefined;
      
      // Use either the btag or npub parameter
      let recipient = btag || npub;
      
      if (!recipient || typeof recipient !== 'string') {
        return res.status(400).json({ 
          message: "Missing or invalid recipient parameter",
          details: "Please provide either a valid btag in the format user@domain.com or a Nostr npub" 
        });
      }
      
      // Process different recipient format types
      if (recipient.startsWith('npub')) {
        // Handle Nostr npub
        console.log(`Looking up payment instructions for npub: ${recipient}`);
        
        try {
          // Get Lightning Address from npub
          const lightningAddress = await getLightningAddressFromNpub(recipient);
          
          if (!lightningAddress) {
            console.log(`No Lightning Address found for npub: ${recipient}`);
            return res.status(404).json({
              message: "Lightning Address not found",
              details: "Could not find a Lightning Address for this Nostr profile"
            });
          }
          
          console.log(`Found Lightning Address for npub: ${lightningAddress}`);
          
          // Also get profile name if available
          const profileName = await getProfileNameFromNpub(recipient);
          
          // Generate an actual Lightning invoice (payment request)
          const amount = 21000; // 21,000 sats for the High Five
          const comment = "High Five Payment";
          const invoice = await getInvoiceFromLightningAddress(lightningAddress, amount, comment);
          
          if (!invoice) {
            console.log(`Failed to generate invoice for Lightning Address: ${lightningAddress}`);
            return res.status(404).json({
              message: "Payment generation failed",
              details: "Could not generate a Lightning invoice for this address"
            });
          }
          
          console.log(`Successfully generated Lightning invoice for ${lightningAddress}`);
          
          return res.status(200).json({
            btag,
            paymentInstructions: invoice,
            paymentType: 'bolt11',
            lightningAddress,
            profileName: profileName || undefined
          });
        } catch (error) {
          console.error(`Error processing npub ${btag}:`, error);
          return res.status(500).json({
            message: "Error processing Nostr profile",
            details: error instanceof Error ? error.message : "Unknown error processing npub"
          });
        }
      } else if (recipient.includes('@')) {
        // Standard btag lookup (email format)
        console.log(`Looking up payment instructions for btag: ${recipient}`);
        const paymentInstructions = await lookupPaymentInstructions(recipient);
        
        if (!paymentInstructions) {
          return res.status(404).json({ 
            message: "Payment instructions not found",
            details: "Could not find payment instructions for the specified btag" 
          });
        }
        
        return res.status(200).json({ 
          btag: recipient, // Use the recipient variable which contains either btag or npub
          paymentInstructions,
          paymentType: 'lno'
        });
      } else {
        // Neither npub nor email format
        return res.status(400).json({
          message: "Invalid recipient format",
          details: "Please provide either a Lightning Address (user@domain.com) or a Nostr npub"
        });
      }
    } catch (error) {
      console.error("Error looking up payment instructions:", error);
      return res.status(500).json({ 
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API endpoint for sending Nostr DMs (for authentication)
  app.post("/api/send-nostr-dm", async (req, res) => {
    try {
      const { recipientPubkey, message } = req.body;
      
      if (!recipientPubkey || !message) {
        return res.status(400).json({ error: "Missing recipient pubkey or message" });
      }
      
      const success = await sendNostrDM(recipientPubkey, message);
      
      if (success) {
        res.status(200).json({ status: "success" });
      } else {
        res.status(500).json({ error: "Failed to send Nostr DM" });
      }
    } catch (error) {
      console.error("Error sending Nostr DM:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve static QR code images from public directory
  app.use('/qr-codes', express.static(qrCodesDir, {
    index: false,
    setHeaders: (res) => {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }));
  
  console.log(`Serving QR code images from ${qrCodesDir}`);

  const httpServer = createServer(app);

  // Add WebSocket server with ping/pong for connection stability
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket & { isAlive?: boolean }) => {
    console.log('WebSocket client connected');
    
    // Mark the connection as alive initially
    ws.isAlive = true;
    
    // Handle pong messages from client (responding to our ping)
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle regular messages
    ws.on('message', (message) => {
      console.log('Received message:', message);
      
      try {
        // Echo back confirmation to the client
        ws.send(JSON.stringify({
          type: 'confirmation',
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Error sending confirmation:', err);
      }
    });
    
    // Send welcome message to client
    try {
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to High Fives server'
      }));
    } catch (err) {
      console.error('Error sending welcome message:', err);
    }
    
    // Handle connection close
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Set up a heartbeat interval to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WebSocket & { isAlive?: boolean };
      
      // If the connection is not alive, terminate it
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      
      // Mark as not alive, will be marked alive again when pong is received
      ws.isAlive = false;
      
      // Send a ping (client automatically responds with pong)
      try {
        ws.ping();
      } catch (err) {
        // If ping fails, terminate the connection
        console.error('Error sending ping:', err);
        ws.terminate();
      }
    });
  }, 30000); // check every 30 seconds
  
  // Clear the interval when the server closes
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return httpServer;
}
