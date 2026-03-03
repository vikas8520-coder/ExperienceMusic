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
  getPreset(id: number): Promise<Preset | undefined>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  updatePreset(id: number, updates: Partial<InsertPreset>): Promise<Preset | undefined>;
  deletePreset(id: number): Promise<boolean>;
  getPresetByShareCode(code: string): Promise<Preset | undefined>;
  setShareCode(id: number, code: string): Promise<Preset | undefined>;
  getPublicPresets(): Promise<Preset[]>;
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

  async getPreset(id: number): Promise<Preset | undefined> {
    const [preset] = await db.select().from(presets).where(eq(presets.id, id));
    return preset;
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const [preset] = await db.insert(presets).values(insertPreset).returning();
    return preset;
  }

  async updatePreset(id: number, updates: Partial<InsertPreset>): Promise<Preset | undefined> {
    const [preset] = await db.update(presets).set(updates).where(eq(presets.id, id)).returning();
    return preset;
  }

  async deletePreset(id: number): Promise<boolean> {
    const result = await db.delete(presets).where(eq(presets.id, id)).returning();
    return result.length > 0;
  }

  async getPresetByShareCode(code: string): Promise<Preset | undefined> {
    const [preset] = await db.select().from(presets).where(eq(presets.shareCode, code));
    return preset;
  }

  async setShareCode(id: number, code: string): Promise<Preset | undefined> {
    const [preset] = await db.update(presets).set({ shareCode: code }).where(eq(presets.id, id)).returning();
    return preset;
  }

  async getPublicPresets(): Promise<Preset[]> {
    return await db.select().from(presets).where(eq(presets.isPublic, true));
  }
}

export const storage = new DatabaseStorage();
