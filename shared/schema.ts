import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull(), // Stores { intensity, speed, colorPalette, etc. }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPresetSchema = createInsertSchema(presets).omit({ 
  id: true, 
  createdAt: true 
});

export type Preset = typeof presets.$inferSelect;
export type InsertPreset = z.infer<typeof insertPresetSchema>;
