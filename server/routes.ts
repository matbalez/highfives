import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr } from "./nostr-http";
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import express from 'express';
import { lookupPaymentInstructions } from "./dns-util";

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

  // New endpoint for looking up payment instructions
  app.get("/api/payment-instructions", async (req, res) => {
    try {
      const { btag } = req.query;
      
      if (!btag || typeof btag !== 'string') {
        return res.status(400).json({ 
          message: "Missing or invalid 'btag' parameter",
          details: "Please provide a valid btag in the format user@domain.com" 
        });
      }
      
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
        paymentInstructions
      });
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
      
      console.log(`Received request to send DM to: ${recipientPubkey}`);
      
      // Extract the PIN for debugging
      const pinMatch = message.match(/verification PIN is: (\d{4})/);
      if (pinMatch && pinMatch[1]) {
        console.log(`Sending PIN: ${pinMatch[1]} to ${recipientPubkey}`);
      }
      
      const success = await sendNostrDM(recipientPubkey, message);
      
      if (success) {
        res.status(200).json({ status: "success" });
      } else {
        res.status(500).json({ error: "Failed to send Nostr DM" });
      }
    } catch (error) {
      console.error("Error sending Nostr DM:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      });
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

  // Add WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      console.log('Received message:', message);
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return httpServer;
}
