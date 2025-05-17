import { 
  users, 
  type User, 
  type InsertUser,
  highFives,
  type HighFive,
  type InsertHighFive,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { IStorage } from "./storage";

export class PgStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createHighFive(insertHighFive: InsertHighFive): Promise<HighFive> {
    const createdAt = new Date().toISOString();
    
    const result = await db.insert(highFives).values({
      recipient: insertHighFive.recipient,
      reason: insertHighFive.reason,
      sender: insertHighFive.sender ?? null,
      createdAt,
      nostrEventId: insertHighFive.nostrEventId ?? null,
      profileName: insertHighFive.profileName ?? null,
      senderProfileName: insertHighFive.senderProfileName ?? null
    }).returning();
    
    return result[0];
  }

  async getHighFive(id: number): Promise<HighFive | undefined> {
    const result = await db.select().from(highFives).where(eq(highFives.id, id));
    return result[0];
  }

  async getAllHighFives(): Promise<HighFive[]> {
    return await db.select().from(highFives).orderBy(highFives.id);
  }
  
  async updateHighFiveNostrEventId(id: number, nostrEventId: string): Promise<HighFive | undefined> {
    const result = await db
      .update(highFives)
      .set({ nostrEventId })
      .where(eq(highFives.id, id))
      .returning();
    
    return result[0];
  }
  
  async updateHighFiveQRCodePath(id: number, qrCodePath: string): Promise<HighFive | undefined> {
    const result = await db
      .update(highFives)
      .set({ qrCodePath })
      .where(eq(highFives.id, id))
      .returning();
    
    return result[0];
  }
}