import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHighFiveSchema } from "@shared/schema";
import { publishHighFiveToNostr } from "./nostr";

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
      
      // Get QR code from request body if available
      const qrCodeDataUrl = req.body.qrCodeDataUrl as string | undefined;

      // Silently publish to Nostr without blocking the response
      publishHighFiveToNostr({
        recipient: validation.data.recipient,
        reason: validation.data.reason,
        amount: Number(validation.data.amount),
        sender: validation.data.sender || undefined,
        qrCodeDataUrl
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

  const httpServer = createServer(app);

  return httpServer;
}
