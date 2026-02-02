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
      const parseResult = api.tracks.extractArtwork.input.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: 'Invalid request: audioBase64 is required' });
      }
      
      const { audioBase64 } = parseResult.data;
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const metadata = await musicMetadata.parseBuffer(audioBuffer);
      
      const picture = metadata.common.picture?.[0];
      
      if (picture) {
        const artworkBase64 = Buffer.from(picture.data).toString('base64');
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

  // SoundCloud API proxy endpoints to avoid CORS issues
  // Get SoundCloud client ID for OAuth flow initiation
  app.get('/api/soundcloud/config', (req, res) => {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'SoundCloud not configured' });
    }
    res.json({ clientId });
  });

  // SoundCloud OAuth: Redirect user to SoundCloud login page
  app.get('/auth/soundcloud', (req, res) => {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
      return res.status(500).send('SoundCloud not configured');
    }

    // Get the origin from the request to build redirect URI
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/callback`;

    // Generate CSRF state and store in cookie
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Set state in HTTP-only cookie for CSRF protection
    res.cookie('soundcloud_oauth_state', state, {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });
    
    const authUrl = new URL('https://soundcloud.com/connect');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
  });

  // SoundCloud OAuth callback: Exchange code for token
  app.get('/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    
    if (error) {
      res.clearCookie('soundcloud_oauth_state');
      return res.redirect(`/#soundcloud_error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code) {
      res.clearCookie('soundcloud_oauth_state');
      return res.redirect('/#soundcloud_error=missing_code');
    }

    // Validate CSRF state from cookie
    const storedState = req.cookies?.soundcloud_oauth_state;
    res.clearCookie('soundcloud_oauth_state');
    
    if (!storedState || !state || storedState !== state) {
      console.error('OAuth state mismatch - possible CSRF attack');
      return res.redirect('/#soundcloud_error=invalid_state');
    }

    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect('/#soundcloud_error=not_configured');
    }

    // Build the same redirect URI that was used in the auth request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/callback`;

    try {
      const tokenResponse = await fetch('https://api.soundcloud.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code as string,
        }).toString(),
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok || tokenData.error) {
        console.error('SoundCloud token exchange failed:', tokenData);
        return res.redirect(`/#soundcloud_error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'token_exchange_failed')}`);
      }

      // Redirect back to app with token in URL fragment (not sent to server logs)
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || '';
      const expiresIn = tokenData.expires_in || 0;
      
      res.redirect(`/#soundcloud_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&expires_in=${expiresIn}`);
    } catch (err) {
      console.error('SoundCloud callback error:', err);
      res.redirect('/#soundcloud_error=server_error');
    }
  });

  // Proxy SoundCloud API requests
  app.get('/api/soundcloud/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    try {
      const response = await fetch('https://api.soundcloud.com/me', {
        headers: { 'Authorization': authHeader }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('SoundCloud /me error:', error);
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  });

  // Search tracks
  app.get('/api/soundcloud/tracks', async (req, res) => {
    const authHeader = req.headers.authorization;
    const { q, limit = '20' } = req.query;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    try {
      const url = new URL('https://api.soundcloud.com/tracks');
      if (q) url.searchParams.set('q', q as string);
      url.searchParams.set('limit', limit as string);
      
      const response = await fetch(url.toString(), {
        headers: { 'Authorization': authHeader }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('SoundCloud tracks search error:', error);
      res.status(500).json({ error: 'Failed to search tracks' });
    }
  });

  // Get user's likes
  app.get('/api/soundcloud/me/likes', async (req, res) => {
    const authHeader = req.headers.authorization;
    const { limit = '50' } = req.query;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    try {
      const url = new URL('https://api.soundcloud.com/me/likes');
      url.searchParams.set('limit', limit as string);
      
      const response = await fetch(url.toString(), {
        headers: { 'Authorization': authHeader }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('SoundCloud likes error:', error);
      res.status(500).json({ error: 'Failed to fetch likes' });
    }
  });

  // Get user's playlists
  app.get('/api/soundcloud/me/playlists', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    try {
      const response = await fetch('https://api.soundcloud.com/me/playlists', {
        headers: { 'Authorization': authHeader }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('SoundCloud playlists error:', error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  });

  // Get stream URL for a track
  app.get('/api/soundcloud/tracks/:id/stream', async (req, res) => {
    const authHeader = req.headers.authorization;
    const { id } = req.params;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    try {
      const response = await fetch(`https://api.soundcloud.com/tracks/${id}/streams`, {
        headers: { 'Authorization': authHeader }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('SoundCloud stream error:', error);
      res.status(500).json({ error: 'Failed to get stream URL' });
    }
  });

  // SoundCloud OAuth token exchange endpoint (for mobile app security)
  // Client secret is kept on server, mobile app only sends authorization code
  app.post('/api/auth/soundcloud/token', async (req, res) => {
    const { code, redirect_uri } = req.body;
    
    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }

    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'SoundCloud credentials not configured' });
    }

    try {
      const tokenResponse = await fetch('https://api.soundcloud.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirect_uri,
          code: code,
        }).toString(),
      });

      const data = await tokenResponse.json();
      
      if (data.error) {
        return res.status(400).json({ error: data.error_description || data.error });
      }

      res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      });
    } catch (error) {
      console.error('SoundCloud token exchange error:', error);
      res.status(500).json({ error: 'Token exchange failed' });
    }
  });

  // SoundCloud refresh token endpoint
  app.post('/api/auth/soundcloud/refresh', async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token' });
    }

    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'SoundCloud credentials not configured' });
    }

    try {
      const tokenResponse = await fetch('https://api.soundcloud.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh_token,
        }).toString(),
      });

      const data = await tokenResponse.json();
      
      if (data.error) {
        return res.status(400).json({ error: data.error_description || data.error });
      }

      res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      });
    } catch (error) {
      console.error('SoundCloud token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  return httpServer;
}
