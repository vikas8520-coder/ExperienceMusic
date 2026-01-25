import { db } from "./db";
import {
  presets,
  tracks,
  type InsertPreset,
  type InsertTrack,
  type Preset,
  type Track
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getTracks(): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  createTrack(track: InsertTrack): Promise<Track>;
  updateTrack(id: number, updates: Partial<InsertTrack>): Promise<Track | undefined>;
  getPresets(): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
}

export class DatabaseStorage implements IStorage {
  async getTracks(): Promise<Track[]> {
    return await db.select().from(tracks);
  }

  async getTrack(id: number): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
    return track;
  }

  async createTrack(insertTrack: InsertTrack): Promise<Track> {
    const [track] = await db.insert(tracks).values(insertTrack).returning();
    return track;
  }

  async updateTrack(id: number, updates: Partial<InsertTrack>): Promise<Track | undefined> {
    const [track] = await db.update(tracks).set(updates).where(eq(tracks.id, id)).returning();
    return track;
  }

  async getPresets(): Promise<Preset[]> {
    return await db.select().from(presets);
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const [preset] = await db.insert(presets).values(insertPreset).returning();
    return preset;
  }
}

export const storage = new DatabaseStorage();
