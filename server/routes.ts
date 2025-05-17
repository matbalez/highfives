import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr } from "./nostr-file";
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import express from 'express';

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

      // Always use the provided Lightning invoice
      const effectiveInvoice = "lno1zrxq8pjw7qjlm68mtp7e3yvxee4y5xrgjhhyf2fxhlphpckrvevh50u0qfj78rhhtjxpghmyqgtmtpntmh2f5fee4zs094je6vly080f7kgsyqsrxwawhx2pdpkm6zy5rsgvvs3w8mpucvudl7dmql4hxg6g8hhjfkkqqvakre23kt02d6nsc5cwrw9dwap3m73jdl7r6nv4nyufh89nc62e0eh9xh6x0a7uqna2g0cty6razaq2kxrrq2wdpfqplvjxdrfzrp4a7dsyhtlgmnrggklu90ck6j3j8wasaq7auqqs2gvv2zuwg446m8p6z5490hyusy";

      // Silently publish to Nostr without blocking the response
      publishHighFiveToNostr({
        recipient: validation.data.recipient,
        reason: validation.data.reason,
        amount: Number(validation.data.amount),
        sender: validation.data.sender || undefined,
        lightningInvoice: effectiveInvoice
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
