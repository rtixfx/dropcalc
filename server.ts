import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import crypto from "crypto";
import Database from "better-sqlite3";
import fs from "fs";
import connectSqlite3 from "better-sqlite3-session-store";

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

const SqliteStore = connectSqlite3(session);

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
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT,
    slug TEXT UNIQUE,
    description TEXT,
    content TEXT,
    bannerImage TEXT,
    readTime TEXT,
    authorId TEXT,
    authorName TEXT,
    publishDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN token TEXT');
} catch (e) {
  // column might already exist
}

try {
  db.exec('ALTER TABLE posts ADD COLUMN isPinned INTEGER DEFAULT 0');
} catch (e) {}

// Secret from Env or fallback
const SESSION_SECRET = process.env.SESSION_SECRET || "glidecalc-super-secret-session-key";

app.use(session({
  store: new SqliteStore({
    client: db, 
    expired: {
      clear: true,
      intervalMs: 900000 //ms = 15min
    }
  }),
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

app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const userRow = db.prepare("SELECT * FROM users WHERE token = ?").get(token) as any;
      if (userRow) {
        req.session.userId = userRow.id;
        req.session.user = {
          id: userRow.id,
          username: userRow.username,
          avatar: userRow.avatar,
          email: userRow.email
        };
      }
    } catch (err) {
      // ignore
    }
  }
  next();
});

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

    const authToken = crypto.randomUUID();
    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (id, username, email, avatar, token) 
        VALUES (?, ?, ?, ?, ?)
      `).run(
        discordUser.id,
        discordUser.username,
        discordUser.email || null,
        discordUser.avatar,
        authToken
      );
    } else {
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, avatar = ?, token = ?, lastLogin = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        discordUser.username,
        discordUser.email || null,
        discordUser.avatar,
        authToken,
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
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: userData, token: '${authToken}' }, '*');
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
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const adminId = process.env.ADMIN_DISCORD_ID;
  const isAdminFlag = !adminId || req.session.userId === adminId;
  res.json({ user: req.session.user, isAdmin: isAdminFlag });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Admin Check Middleware
const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminId = process.env.ADMIN_DISCORD_ID;
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (adminId && req.session.userId !== adminId) {
    res.status(403).json({ error: "Forbidden: Admins only" });
    return;
  }
  next();
};

app.get("/api/posts", (req, res) => {
  try {
    const posts = db.prepare("SELECT * FROM posts ORDER BY isPinned DESC, publishDate DESC").all();
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/posts/:slug", (req, res) => {
  try {
    const post = db.prepare("SELECT * FROM posts WHERE slug = ?").get(req.params.slug);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(post);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/posts", isAdmin, (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { title, slug, description, content, bannerImage, readTime, tags, isPinned } = req.body;
    db.prepare(`
      INSERT INTO posts (id, title, slug, description, content, bannerImage, readTime, authorId, authorName, tags, isPinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, title, slug, description, content, bannerImage, readTime,
      req.session.userId, req.session.user?.username, tags, isPinned ? 1 : 0
    );
    res.json({ success: true, id, slug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/posts/:id", isAdmin, (req, res) => {
  try {
    const { title, slug, description, content, bannerImage, readTime, tags, isPinned } = req.body;
    db.prepare(`
      UPDATE posts SET title=?, slug=?, description=?, content=?, bannerImage=?, readTime=?, tags=?, isPinned=?
      WHERE id=?
    `).run(title, slug, description, content, bannerImage, readTime, tags, isPinned ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/posts/:id", isAdmin, (req, res) => {
  try {
    console.log("Deleting post with id:", req.params.id);
    db.prepare("DELETE FROM posts WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
