import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr } from "./nostr-http";
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { lookupPaymentInstructions } from "./dns-util";
import { getLightningAddressFromNpub } from "./nostr-profile";
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
      
      const highFive = await storage.createHighFive(validation.data);
      
      // Get Lightning invoice from request body if available
      const lightningInvoice = req.body.lightningInvoice as string | undefined;

      // Only proceed with Nostr publication if we have a valid lightning invoice
      if (lightningInvoice) {
        console.log('Using payment instruction for Nostr publication:', { 
          type: 'from DNS lookup',
          preview: lightningInvoice.substring(0, 30) + '...'
        });

        // Silently publish to Nostr without blocking the response
        publishHighFiveToNostr({
          recipient: validation.data.recipient,
          reason: validation.data.reason,
          sender: validation.data.sender || undefined,
          lightningInvoice: lightningInvoice
        }).catch(error => {
          // Log error but don't affect the main flow
          console.error('Error publishing to Nostr (non-blocking):', error);
        });
      } else {
        console.log('Skipping Nostr publication due to missing payment instruction');
      }
      
      return res.status(201).json(highFive);
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

  // Endpoint for looking up payment instructions from btag or npub
  app.get("/api/payment-instructions", async (req, res) => {
    try {
      const { btag } = req.query;
      
      if (!btag || typeof btag !== 'string') {
        return res.status(400).json({ 
          message: "Missing or invalid 'btag' parameter",
          details: "Please provide a valid btag in the format user@domain.com or a Nostr npub" 
        });
      }
      
      // Process different recipient format types
      if (btag.startsWith('npub')) {
        // Handle Nostr npub
        console.log(`Looking up payment instructions for npub: ${btag}`);
        
        try {
          // Get Lightning Address from npub
          const lightningAddress = await getLightningAddressFromNpub(btag);
          
          if (!lightningAddress) {
            console.log(`No Lightning Address found for npub: ${btag}`);
            return res.status(404).json({
              message: "Lightning Address not found",
              details: "Could not find a Lightning Address for this Nostr profile"
            });
          }
          
          console.log(`Found Lightning Address for npub: ${lightningAddress}`);
          
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
            lightningAddress
          });
        } catch (error) {
          console.error(`Error processing npub ${btag}:`, error);
          return res.status(500).json({
            message: "Error processing Nostr profile",
            details: error instanceof Error ? error.message : "Unknown error processing npub"
          });
        }
      } else if (btag.includes('@')) {
        // Standard btag lookup (email format)
        console.log(`Looking up payment instructions for btag: ${btag}`);
        const paymentInstructions = await lookupPaymentInstructions(btag);
        
        if (!paymentInstructions) {
          return res.status(404).json({ 
            message: "Payment instructions not found",
            details: "Could not find payment instructions for the specified btag" 
          });
        }
        
        return res.status(200).json({ 
          btag,
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
