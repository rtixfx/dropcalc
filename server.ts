import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import crypto from "crypto";
import Database from "better-sqlite3";
import fs from "fs";

const app = express();
app.set("trust proxy", 1);
const PORT = 3000;

app.use(express.json());

// Initialize SQLite Database
const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(path.join(dbDir, "glidecalc.db"));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT,
    avatar TEXT,
    lastLogin TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Secret from Env or fallback
const SESSION_SECRET = process.env.SESSION_SECRET || "glidecalc-super-secret-session-key";

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // Required for SameSite=None
    sameSite: 'none',  // Required for cross-origin iframe
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// Provide session types
declare module "express-session" {
  interface SessionData {
    oauthState: string;
    userId: string;
    user: {
      id: string;
      username: string;
      avatar: string;
      email: string | null;
    };
  }
}

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

function getAppUrl(req: express.Request): string {
  // Use env APP_URL or fallback to request origin
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl;
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}`;
}

app.get("/api/auth/discord/url", (req, res) => {
  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email"
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

app.get(["/api/auth/discord/callback", "/api/auth/discord/callback/"], async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing code from Discord.");
    }

    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/api/auth/discord/callback`;

    // Exchange code for token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID || "",
        client_secret: DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Token error:", errText);
      return res.status(400).send("Failed to exchange token.");
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      return res.status(400).send("Failed to fetch Discord profile.");
    }

    const discordUser = await userResponse.json();

    // Save to SQLite
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    const existingUser = stmt.get(discordUser.id);

    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (id, username, email, avatar) 
        VALUES (?, ?, ?, ?)
      `).run(
        discordUser.id,
        discordUser.username,
        discordUser.email || null,
        discordUser.avatar
      );
    } else {
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, avatar = ?, lastLogin = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        discordUser.username,
        discordUser.email || null,
        discordUser.avatar,
        discordUser.id
      );
    }

    // Set session
    req.session.userId = discordUser.id;
    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      email: discordUser.email || null
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
      }
      
      // Close popup and notify parent
      res.send(`
        <html>
          <body>
            <script>
              const userData = ${JSON.stringify(req.session.user)};
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: userData }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    });
  } catch (err: any) {
    console.error("Callback error:", err);
    res.status(500).send("Internal Server Error during callback");
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

async function startServer() {
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
