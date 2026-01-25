import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.presets.list.path, async (req, res) => {
    const presets = await storage.getPresets();
    res.json(presets);
  });

  app.post(api.presets.create.path, async (req, res) => {
    const preset = await storage.createPreset(req.body);
    res.status(201).json(preset);
  });

  // Seed default presets if none exist
  const existing = await storage.getPresets();
  if (existing.length === 0) {
    await storage.createPreset({
      name: "Default Energy",
      settings: {
        intensity: 1.0,
        speed: 1.0,
        colorPalette: ["#ff0000", "#00ff00", "#0000ff"]
      }
    });
  }

  return httpServer;
}
