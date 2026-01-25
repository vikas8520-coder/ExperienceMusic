import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import OpenAI from "openai";
import express from "express";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import * as musicMetadata from "music-metadata";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.json({ limit: '50mb' }));

  // Track endpoints
  app.get(api.tracks.list.path, async (req, res) => {
    const tracks = await storage.getTracks();
    res.json(tracks);
  });

  app.get(api.tracks.get.path, async (req, res) => {
    const track = await storage.getTrack(Number(req.params.id));
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.json(track);
  });

  app.post(api.tracks.create.path, async (req, res) => {
    const track = await storage.createTrack(req.body);
    res.status(201).json(track);
  });

  app.put(api.tracks.update.path, async (req, res) => {
    const track = await storage.updateTrack(Number(req.params.id), req.body);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.json(track);
  });

  // Analyze thumbnail with AI Vision to extract colors and theme
  app.post(api.tracks.analyzeThumbnail.path, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ message: 'Image data required' });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert visual analyst for music visualization. Analyze images and extract:
1. A color palette of 5-7 hex colors that best represent the image
2. The overall theme/mood (e.g., "cosmic", "nature", "urban", "abstract", "psychedelic")
3. The emotional mood (e.g., "energetic", "calm", "mysterious", "uplifting")
4. Visual suggestions for audio-reactive visualizations based on the image

Respond in JSON format:
{
  "colorPalette": ["#hex1", "#hex2", ...],
  "theme": "theme name",
  "mood": "mood description",
  "visualSuggestions": ["suggestion1", "suggestion2", ...]
}`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: "text",
                text: "Analyze this album artwork/thumbnail and extract the color palette, theme, mood, and visualization suggestions."
              }
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      res.json({
        colorPalette: analysis.colorPalette || [],
        theme: analysis.theme || 'abstract',
        mood: analysis.mood || 'neutral',
        visualSuggestions: analysis.visualSuggestions || []
      });
    } catch (error) {
      console.error('Error analyzing thumbnail:', error);
      res.status(500).json({ message: 'Failed to analyze thumbnail' });
    }
  });

  // Extract artwork from audio file
  app.post(api.tracks.extractArtwork.path, async (req, res) => {
    try {
      const { audioBase64 } = req.body;
      
      if (!audioBase64) {
        return res.status(400).json({ message: 'Audio data required' });
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const metadata = await musicMetadata.parseBuffer(audioBuffer);
      
      const picture = metadata.common.picture?.[0];
      
      if (picture) {
        const artworkBase64 = picture.data.toString('base64');
        res.json({
          artwork: artworkBase64,
          mimeType: picture.format,
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
        });
      } else {
        res.json({
          artwork: null,
          mimeType: null,
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
        });
      }
    } catch (error) {
      console.error('Error extracting artwork:', error);
      res.status(500).json({ message: 'Failed to extract artwork from audio' });
    }
  });

  // Upload thumbnail and analyze it
  app.post(api.tracks.uploadThumbnail.path, async (req, res) => {
    try {
      const trackId = Number(req.params.id);
      const { imageBase64, filename } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: 'Image data required' });
      }

      const track = await storage.getTrack(trackId);
      if (!track) {
        return res.status(404).json({ message: 'Track not found' });
      }

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      // Save the image
      const ext = filename?.split('.').pop() || 'jpg';
      const savedFilename = `thumbnail_${trackId}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, savedFilename);
      await writeFile(filePath, Buffer.from(imageBase64, 'base64'));

      const thumbnailUrl = `/uploads/${savedFilename}`;

      // Analyze the thumbnail with AI
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze this image and extract a color palette of 5-7 hex colors and a theme name. Respond in JSON: {"colorPalette": ["#hex1", ...], "theme": "theme name"}`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = analysisResponse.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      // Update the track with analyzed data
      await storage.updateTrack(trackId, {
        thumbnailUrl,
        colorPalette: analysis.colorPalette || [],
        theme: analysis.theme || 'abstract'
      });

      res.json({
        thumbnailUrl,
        colorPalette: analysis.colorPalette || [],
        theme: analysis.theme || 'abstract'
      });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      res.status(500).json({ message: 'Failed to upload thumbnail' });
    }
  });

  // Preset endpoints
  app.get(api.presets.list.path, async (req, res) => {
    const presets = await storage.getPresets();
    res.json(presets);
  });

  app.post(api.presets.create.path, async (req, res) => {
    const preset = await storage.createPreset(req.body);
    res.status(201).json(preset);
  });

  // Seed default data if none exists
  const existingTracks = await storage.getTracks();
  if (existingTracks.length === 0) {
    await storage.createTrack({
      name: "Cosmic Journey",
      description: "An ethereal space-themed track",
      colorPalette: ["#1a0a2e", "#16213e", "#0f3460", "#e94560", "#533483"],
      theme: "cosmic"
    });
  }

  const existingPresets = await storage.getPresets();
  if (existingPresets.length === 0) {
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
