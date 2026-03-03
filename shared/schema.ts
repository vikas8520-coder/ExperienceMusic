import { pgTable, text, serial, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  colorPalette: jsonb("color_palette").$type<string[]>(),
  theme: text("theme"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trackId: integer("track_id").references(() => tracks.id),
  settings: jsonb("settings").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Marketplace fields
  author: text("author"),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  thumbnail: text("thumbnail"),
  shareCode: text("share_code"),
  version: integer("version").default(1),
  updatedAt: timestamp("updated_at").defaultNow(),
  isPublic: boolean("is_public").default(false),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTrackSchema = createInsertSchema(tracks).omit({ 
  id: true, 
  createdAt: true 
});

export const insertPresetSchema = createInsertSchema(presets).omit({ 
  id: true, 
  createdAt: true 
});

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Preset = typeof presets.$inferSelect;
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
