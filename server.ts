import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth Exchange Route
  app.post("/api/auth/google/exchange", async (req, res) => {
    try {
      const { code, clientId, clientSecret, redirectUri } = req.body;
      
      if (!code || !clientId || !clientSecret) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri || 'postmessage'
      );

      const { tokens } = await oauth2Client.getToken(code);
      res.json(tokens);
    } catch (error: any) {
      console.error("OAuth Exchange Error:", error);
      res.status(500).json({ error: error.message || "Failed to exchange code" });
    }
  });

  // Google OAuth Refresh Route
  app.post("/api/auth/google/refresh", async (req, res) => {
    try {
      const { refreshToken, clientId, clientSecret } = req.body;

      if (!refreshToken || !clientId || !clientSecret) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      res.json(credentials);
    } catch (error: any) {
      console.error("OAuth Refresh Error:", error);
      res.status(500).json({ error: error.message || "Failed to refresh token" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
