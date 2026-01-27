import { z } from 'zod';
import { insertPresetSchema, insertTrackSchema, presets, tracks } from './schema';

export const api = {
  tracks: {
    list: {
      method: 'GET' as const,
      path: '/api/tracks',
      responses: {
        200: z.array(z.custom<typeof tracks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tracks/:id',
      responses: {
        200: z.custom<typeof tracks.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tracks',
      input: insertTrackSchema,
      responses: {
        201: z.custom<typeof tracks.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tracks/:id',
      input: insertTrackSchema.partial(),
      responses: {
        200: z.custom<typeof tracks.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    uploadThumbnail: {
      method: 'POST' as const,
      path: '/api/tracks/:id/thumbnail',
      responses: {
        200: z.object({
          thumbnailUrl: z.string(),
          colorPalette: z.array(z.string()),
          theme: z.string(),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    analyzeThumbnail: {
      method: 'POST' as const,
      path: '/api/analyze-thumbnail',
      input: z.object({ imageBase64: z.string() }),
      responses: {
        200: z.object({
          colorPalette: z.array(z.string()),
          theme: z.string(),
          mood: z.string(),
          visualSuggestions: z.array(z.string()),
        }),
      },
    },
  },
  presets: {
    list: {
      method: 'GET' as const,
      path: '/api/presets',
      responses: {
        200: z.array(z.custom<typeof presets.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/presets',
      input: insertPresetSchema,
      responses: {
        201: z.custom<typeof presets.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
