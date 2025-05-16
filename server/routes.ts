import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr } from "./nostr";
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';

// Create public directory and qr-codes subdirectory if they don't exist
const publicDir = path.join(process.cwd(), 'public');
const qrCodesDir = path.join(publicDir, 'qr-codes');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(qrCodesDir)) {
  fs.mkdirSync(qrCodesDir, { recursive: true });
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
      
      const highFive = await storage.createHighFive(validation.data);
      
      // Get Lightning invoice from request body if available
      const lightningInvoice = req.body.lightningInvoice as string | undefined;

      // Generate a QR code and save it to a file if there's a lightning invoice
      let qrCodeUrl = '';
      if (lightningInvoice) {
        const qrCodeFilename = `${crypto.randomUUID()}.png`;
        const qrCodePath = path.join(qrCodesDir, qrCodeFilename);
        
        try {
          // Generate and save QR code
          await QRCode.toFile(qrCodePath, lightningInvoice, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });

          // Public URL for the QR code
          const host = req.headers.host || 'localhost:5000';
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          qrCodeUrl = `${protocol}://${host}/qr-codes/${qrCodeFilename}`;
          console.log(`Generated QR code at: ${qrCodeUrl}`);
        } catch (qrError) {
          console.error('Error generating QR code:', qrError);
        }
      }

      // Silently publish to Nostr without blocking the response
      publishHighFiveToNostr({
        recipient: validation.data.recipient,
        reason: validation.data.reason,
        amount: Number(validation.data.amount),
        sender: validation.data.sender || undefined,
        lightningInvoice,
        qrCodeUrl
      }).catch(error => {
        // Log error but don't affect the main flow
        console.error('Error publishing to Nostr (non-blocking):', error);
      });
      
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

  // Serve static QR code images
  app.use('/qr-codes', (req, res, next) => {
    const options = {
      root: qrCodesDir,
      dotfiles: 'deny' as const,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': 'image/png'
      }
    };

    const fileName = req.path.substring(1);
    if (fileName && /^[a-zA-Z0-9_-]+\.png$/.test(fileName)) {
      return res.sendFile(fileName, options, (err) => {
        if (err) {
          console.error(`Error serving QR code: ${err.message}`);
          next();
        }
      });
    } else {
      next();
    }
  });

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
