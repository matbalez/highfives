import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Define the high five schema
export const highFives = pgTable("high_fives", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  reason: text("reason").notNull(),
  amount: integer("amount").default(0),
  sender: text("sender"),
  createdAt: text("created_at").notNull(), // Storing timestamp as string for simplicity
});

export const insertHighFiveSchema = createInsertSchema(highFives).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertHighFive = z.infer<typeof insertHighFiveSchema>;
export type HighFive = typeof highFives.$inferSelect;
