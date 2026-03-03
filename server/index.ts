import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import fs from "fs";
import path from "path";
import { createServer as createHttpServer, type Server as HttpServer } from "http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "https";

type NodeServer = HttpServer | HttpsServer;

function createAppServer(app: Express): NodeServer {
  const devHttpsEnabled =
    process.env.NODE_ENV !== "production" && process.env.APP_DEV_HTTPS === "1";

  if (!devHttpsEnabled) {
    return createHttpServer(app);
  }

  const keyPath =
    process.env.APP_DEV_HTTPS_KEY_PATH ??
    path.resolve(process.cwd(), "certs", "dev-ipad.key");
  const certPath =
    process.env.APP_DEV_HTTPS_CERT_PATH ??
    path.resolve(process.cwd(), "certs", "dev-ipad.crt");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      `APP_DEV_HTTPS=1 but certificate files were not found (key=${keyPath}, cert=${certPath})`,
    );
  }

  return createHttpsServer(
    {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    },
    app,
  );
}

const app = express();
const appServer = createAppServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());

app.use(
  express.json({
    limit: '100mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '100mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(appServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(appServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  const protocol =
    process.env.NODE_ENV !== "production" && process.env.APP_DEV_HTTPS === "1"
      ? "https"
      : "http";
  appServer.listen(
    {
      port,
      host,
    },
    () => {
      const displayHost = host === "0.0.0.0" ? "localhost" : host;
      log(`serving on ${protocol}://${displayHost}:${port}`);
      if (protocol === "http") {
        log(
          `mic capture requires a secure origin; use http://localhost:${port} (not http://0.0.0.0:${port})`,
        );
      }
    },
  );
})();
