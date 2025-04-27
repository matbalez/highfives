import { 
  users, 
  type User, 
  type InsertUser,
  highFives,
  type HighFive,
  type InsertHighFive,
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // High Five methods
  createHighFive(highFive: InsertHighFive): Promise<HighFive>;
  getAllHighFives(): Promise<HighFive[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private highFives: Map<number, HighFive>;
  private userCurrentId: number;
  private highFiveCurrentId: number;

  constructor() {
    this.users = new Map();
    this.highFives = new Map();
    this.userCurrentId = 1;
    this.highFiveCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createHighFive(insertHighFive: InsertHighFive): Promise<HighFive> {
    const id = this.highFiveCurrentId++;
    const createdAt = new Date().toISOString();
    const highFive: HighFive = { 
      id, 
      recipient: insertHighFive.recipient,
      reason: insertHighFive.reason,
      amount: insertHighFive.amount ?? 0,
      sender: insertHighFive.sender ?? null,
      createdAt 
    };
    this.highFives.set(id, highFive);
    return highFive;
  }

  async getAllHighFives(): Promise<HighFive[]> {
    return Array.from(this.highFives.values());
  }
}

export const storage = new MemStorage();
