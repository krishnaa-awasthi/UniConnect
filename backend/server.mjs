// backend/server.mjs
import compression from "compression";
import cors from "cors";
import crypto from "crypto";
import 'dotenv/config';
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import fsPromises from "fs/promises";
import helmet from "helmet";
import http from "http";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import multer from "multer";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { fileURLToPath } from "url";
import {v2 as cloudinary} from 'cloudinary';

// Optional Redis (ioredis) - only used if REDIS_URL set
let Redis;
try { Redis = (await import("ioredis")).default; } catch (e) { /* optional */ }

import connectDB from "./config/db.js";
import Chat from "./models/Chat.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =============================
   ENV & CONFIG
   ============================= */
const {
  NODE_ENV = "development",
  HOST = "0.0.0.0",
  PORT = 3000,
  CLIENT_ORIGIN = "",           // comma-separated allowed origins
  ALLOW_PUBLIC_UPLOADS = "false",
  JWT_SECRET,
  ACCESS_EXPIRES = "1d",
  POSTS_PER_USER_CAP = "500",
  REDIS_URL = "",
} = process.env;

const isProd = NODE_ENV === "production";
const allowPublicUploads = String(ALLOW_PUBLIC_UPLOADS).toLowerCase() === "true";
const POSTS_CAP = Math.max(50, Number(POSTS_PER_USER_CAP) || 500);

// enforce JWT secret
if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is required. Set JWT_SECRET in your environment. Exiting.");
  process.exit(1);
}

/* =============================
   Optional Redis for blacklist
   ============================= */
let redisClient = null;
let useRedis = false;
if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL);
    useRedis = true;
    redisClient.on("error", (e) => console.error("Redis error:", e));
    console.log("✅ Redis connected for token blacklist");
  } catch (err) {
    console.warn("⚠️ Failed to init Redis, falling back to in-memory blacklist:", err?.message || err);
    redisClient = null;
    useRedis = false;
  }
}

/* =============================
   Connect DB
   ============================= */
await connectDB();

/* =============================
   App + Socket.IO setup
   ============================= */
const app = express();
const server = http.createServer(app);

const clientOrigins = CLIENT_ORIGIN ? CLIENT_ORIGIN.split(",").map(s => s.trim()).filter(Boolean) : [];
const io = new SocketIOServer(server, {
  cors: {
    origin: clientOrigins.length > 0 ? clientOrigins : true,
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 25000,
});

/* =============================
   ERP auth loader (optional)
   ============================= */
let authFn;
try {
  const mod = await import("erp-snap-auth");
  authFn = mod?.isAuthenticatedWithPsit || mod?.default?.isAuthenticatedWithPsit;
  if (typeof authFn !== "function") throw new Error("isAuthenticatedWithPsit not found");
} catch (err) {
  if (process.env.SKIP_ERP_AUTH === "true") {
    console.warn("⚠️ erp-snap-auth not available — SKIP_ERP_AUTH=true; running in dev bypass mode.");
    authFn = async () => true;
  } else {
    console.warn("erp-snap-auth not available. To proceed in dev set SKIP_ERP_AUTH=true or install the module.");
    authFn = async () => false;
  }
}

/* =============================
   Middleware: security, parsers, logging
   ============================= */
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(morgan(isProd ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =============================
   CORS - restrict in prod, permissive in dev
   ============================= */
const corsAllowed = [
  ...clientOrigins,
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];
const corsRegexAllowed = [
  /^https?:\/\/(.*\.)?ngrok-free\.app$/i,
  /^https?:\/\/(.*\.)?trycloudflare\.com$/i,
];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (corsAllowed.includes(origin) || corsRegexAllowed.some(r => r.test(origin))) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

/* =============================
   Rate limiting
   ============================= */
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: { success: false, message: "Too many attempts. Try again later." },
});

/* =============================
   Uploads: storage, multer, validation
   ============================= */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    const name = crypto.randomBytes(12).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

function imageFileFilter(_req, file, cb) {
  const ok = /^(image\/(jpeg|jpg|png|gif|webp))$/i.test(file.mimetype);
  if (!ok) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only image files are allowed"));
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

async function validateImageMagic(fullPath) {
  const fd = await fsPromises.open(fullPath, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await fd.read(buffer, 0, 12, 0);
    if (!bytesRead) return false;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    if (buffer.slice(0, 4).toString("hex") === "89504e47") return true;
    if (buffer.slice(0, 4).toString() === "GIF8") return true;
    if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return true;
    return false;
  } finally {
    await fd.close();
  }
}

/* =============================
   Auth helpers, blacklist
   ============================= */
const signToken = (user) =>
  jwt.sign({ _id: user._id.toString(), collegeId: user.collegeId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });

function extractTokenFromRequest(req) {
  const header = req.headers.authorization || "";
  const tokenFromHeader = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (tokenFromHeader) return tokenFromHeader;
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=(.+?)(?:;|$)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

// blacklist: Redis optional else in-memory
const inMemoryBlacklist = new Map(); // token -> expiryTimestamp
function blacklistToken(token, ttlSeconds = 24 * 60 * 60) {
  if (!token) return;
  if (useRedis) {
    try { redisClient.setex(`blacklist:${token}`, ttlSeconds, "1").catch(() => {}); } catch (e) { /* ignore */ }
    return;
  }
  const exp = Date.now() + ttlSeconds * 1000;
  inMemoryBlacklist.set(token, exp);
}
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of inMemoryBlacklist.entries()) if (exp <= now) inMemoryBlacklist.delete(t);
}, 60 * 1000).unref();

/* verify token (sync jwt.verify used inside auth middleware) */

/* expose io on req for routes that emit */
app.use((req, _res, next) => { req.io = io; next(); });

/* =============================
   Socket.IO auth & presence
   ============================= */
io.use(async (socket, next) => {
  try {
    const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
    const token = raw.replace(/^Bearer\s+/i, "");
    if (!token) return next(new Error("No token provided"));

    if (useRedis) {
      const black = await redisClient.get(`blacklist:${token}`);
      if (black) return next(new Error("Token revoked"));
    } else {
      if (inMemoryBlacklist.has(token)) return next(new Error("Token revoked"));
    }

    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    return next();
  } catch (err) {
    console.warn("Socket auth error:", err?.message || err);
    return next(new Error("Invalid token"));
  }
});

const onlineUsers = new Map();
const addPresence = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};
const removePresence = (userId, socketId) => {
  if (!onlineUsers.has(userId)) return;
  const set = onlineUsers.get(userId);
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
};
const broadcastPresence = () => {
  const ids = [...onlineUsers.keys()];
  io.emit("presence:update", ids);
};

io.on("connection", (socket) => {
  const userId = socket.user?._id?.toString();
  if (!userId) return socket.disconnect(true);

  socket.join(userId);
  addPresence(userId, socket.id);
  broadcastPresence();

  socket.on("typing", ({ chatId, to }) => {
    try { if (to) io.to(to.toString()).emit("typing", { from: userId, chatId }); } catch (err) { console.warn("Typing emit error:", err?.message || err); }
  });

  socket.on("disconnect", () => {
    removePresence(userId, socket.id);
    broadcastPresence();
  });
});

/* =============================
   Utilities
   ============================= */
function absoluteFileUrl(req, relPath) {
  if (!relPath) return relPath;
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}${relPath}`;
}
const jsonError = (res, status, msg) => res.status(status).json({ success: false, message: msg });

/* =============================
   ROUTES
   ============================= */

/** HEALTH */
app.get("/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

/** LOGIN */
app.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return jsonError(res, 400, "College ID & password required");
    const collegeId = username.toString().trim();
    const pwd = password.toString();

    // basic validation
    if (!/^[a-zA-Z0-9@._-]{3,50}$/.test(collegeId)) return jsonError(res, 400, "Invalid College ID format");
    if (pwd.length < 4) return jsonError(res, 400, "Password too short");

    const isAuth = await authFn(collegeId, pwd);
    if (!isAuth) return jsonError(res, 401, "Invalid College ID or Password");

    let user = await User.findOne({ collegeId });
    if (!user) {
      user = await User.create({
        collegeId,
        username: collegeId,
        bio: "Hello! This is my profile.",
        profilePic: "",
        coverPic: "",
        posts: [],
      });
    }

    const token = signToken(user);

    // set cookie
    const cookieParts = [`accessToken=${encodeURIComponent(token)}`, "HttpOnly", "Path=/", `Max-Age=${24 * 60 * 60}`];
    if (isProd) cookieParts.push("Secure", "SameSite=None");
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    return res.json({ success: true, message: "Login successful", token, profile: user });
  } catch (err) {
    console.error("ERP login error:", err);
    return jsonError(res, 500, "Server error during login");
  }
});

/** LOGOUT */
app.post("/logout", async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);
    if (token) blacklistToken(token, 24 * 60 * 60);
    const cookieParts = ["accessToken=; HttpOnly; Path=/; Max-Age=0"];
    if (isProd) cookieParts.push("Secure", "SameSite=None");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
    return res.json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return jsonError(res, 500, "Failed to logout");
  }
});

/** AUTH MIDDLEWARE */
const auth = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, message: "Missing token" });

    if (useRedis) {
      const black = await redisClient.get(`blacklist:${token}`);
      if (black) return res.status(401).json({ success: false, message: "Token revoked" });
    } else {
      if (inMemoryBlacklist.has(token)) return res.status(401).json({ success: false, message: "Token revoked" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.warn("Auth error:", err?.message || err);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/** CURRENT USER */
app.get("/me", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("-password -sensitiveField").lean();
    if (!me) return jsonError(res, 404, "Profile not found");
    return res.json({ success: true, profile: me });
  } catch (err) {
    console.error("/me error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/** PROFILE (public read) - safe fields only */
app.get("/profile", async (req, res) => {
  const { username } = req.query;
  if (!username) return jsonError(res, 400, "username query param required");
  try {
    const user = await User.findOne({ collegeId: username.toString() })
      .select("collegeId username bio profilePic coverPic")
      .lean();
    if (!user) return jsonError(res, 404, "Profile not found");

    if (user.profilePic && user.profilePic.startsWith("/uploads/")) user.profilePic = absoluteFileUrl(req, user.profilePic);
    if (user.coverPic && user.coverPic.startsWith("/uploads/")) user.coverPic = absoluteFileUrl(req, user.coverPic);
    return res.json({ success: true, profile: user });
  } catch (err) {
    console.error("/profile error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/** PROFILE UPDATE */
app.post("/profile/update", auth, async (req, res) => {
  try {
    const { newUsername, bio } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) return jsonError(res, 404, "Profile not found");

    if (typeof newUsername === "string" && newUsername.trim()) {
      const cleaned = newUsername.trim();
      if (cleaned.length < 2 || cleaned.length > 30) return jsonError(res, 400, "Username must be 2-30 characters");
      user.username = cleaned;
    }
    if (typeof bio === "string") user.bio = bio.toString().slice(0, 500);

    await user.save();
    return res.json({ success: true, profile: user });
  } catch (err) {
    console.error("/profile/update error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/** PROFILE IMAGE UPLOADS (profilePic / coverPic) */
app.post("/profile/upload-pic", auth, upload.single("profilePic"), async (req, res) => {
  try {
    if (!req.file) return jsonError(res, 400, "No image file provided.");
    const fullPath = path.join(uploadsDir, req.file.filename);

    const ok = await validateImageMagic(fullPath);
    if (!ok) {
      await fsPromises.unlink(fullPath).catch(() => {});
      return jsonError(res, 400, "Uploaded file is not a valid image.");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      await fsPromises.unlink(fullPath).catch(() => {});
      return jsonError(res, 404, "Profile not found");
    }

    const picUrl = `/uploads/${req.file.filename}`;
    user.profilePic = picUrl;
    await user.save();
    return res.json({ success: true, url: absoluteFileUrl(req, picUrl) });
  } catch (err) {
    console.error("/profile/upload-pic error:", err);
    if (req.file) await fsPromises.unlink(path.join(uploadsDir, req.file?.filename)).catch(() => {});
    if (err instanceof multer.MulterError) return jsonError(res, 400, err.message || "File upload error");
    return jsonError(res, 500, "Internal server error");
  }
});

app.post("/profile/upload-cover", auth, upload.single("coverPic"), async (req, res) => {
  try {
    if (!req.file) return jsonError(res, 400, "No image file provided.");
    const fullPath = path.join(uploadsDir, req.file.filename);

    const ok = await validateImageMagic(fullPath);
    if (!ok) {
      await fsPromises.unlink(fullPath).catch(() => {});
      return jsonError(res, 400, "Uploaded file is not a valid image.");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      await fsPromises.unlink(fullPath).catch(() => {});
      return jsonError(res, 404, "Profile not found");
    }

    const coverUrl = `/uploads/${req.file.filename}`;
    user.coverPic = coverUrl;
    await user.save();
    return res.json({ success: true, url: absoluteFileUrl(req, coverUrl) });
  } catch (err) {
    console.error("/profile/upload-cover error:", err);
    if (req.file) await fsPromises.unlink(path.join(uploadsDir, req.file?.filename)).catch(() => {});
    if (err instanceof multer.MulterError) return jsonError(res, 400, err.message || "File upload error");
    return jsonError(res, 500, "Internal server error");
  }
});

/** POSTS: create a post (multipart / with file) */
app.post("/posts/add", auth, upload.single("image"), async (req, res) => {
  try {
    const caption = (req.body?.caption || "").toString().trim().slice(0, 1000);
    const user = await User.findById(req.user._id);
    if (!user) return jsonError(res, 404, "Profile not found");

    let imageUrl = null;
    if (req.file) {
      const fullPath = path.join(uploadsDir, req.file.filename);
      const ok = await validateImageMagic(fullPath);
      if (!ok) {
        await fsPromises.unlink(fullPath).catch(() => {});
        return jsonError(res, 400, "Uploaded file is not a valid image.");
      }
      imageUrl = `/uploads/${req.file.filename}`;
    }

    user.posts.unshift({ caption, image: imageUrl, createdAt: new Date() });
    if (user.posts.length > POSTS_CAP) user.posts = user.posts.slice(0, POSTS_CAP);
    await user.save();

    io.to(req.user._id.toString()).emit("post:created", { userId: req.user._id, post: user.posts[0] });
    return res.json({ success: true, posts: user.posts });
  } catch (err) {
    console.error("/posts/add error:", err);
    if (req.file) await fsPromises.unlink(path.join(uploadsDir, req.file?.filename)).catch(() => {});
    if (err instanceof multer.MulterError) return jsonError(res, 400, err.message || "File upload error");
    return jsonError(res, 500, "Internal server error");
  }
});

/** POSTS: create a post (JSON / media.uri) */
app.post("/posts", auth, async (req, res) => {
  try {
    const { caption = "", media } = req.body || {};
    const cleanedCaption = (caption || "").toString().trim().slice(0, 1000);
    const user = await User.findById(req.user._id);
    if (!user) return jsonError(res, 404, "Profile not found");

    let imageUrl = null;
    if (media && typeof media.uri === "string" && media.uri.length > 0) imageUrl = media.uri;

    user.posts.unshift({ caption: cleanedCaption, image: imageUrl, createdAt: new Date() });
    if (user.posts.length > POSTS_CAP) user.posts = user.posts.slice(0, POSTS_CAP);
    await user.save();

    io.to(req.user._id.toString()).emit("post:created", { userId: req.user._id, post: user.posts[0] });
    return res.status(201).json({ success: true, posts: user.posts });
  } catch (err) {
    console.error("/posts (json) error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/** FEED: get posts (requires auth) */
app.get("/posts", auth, async (req, res) => {
  try {
    const users = await User.find().select("username profilePic posts collegeId").lean();
    const allPosts = users.flatMap((user) =>
      (user.posts || []).map((post) => ({ ...post, user: { username: user.username, profilePic: user.profilePic, collegeId: user.collegeId } }))
    );
    allPosts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    allPosts.forEach((p) => {
      if (p.image && p.image.startsWith("/uploads/")) p.image = absoluteFileUrl(req, p.image);
      if (p.user?.profilePic && p.user.profilePic.startsWith("/uploads/")) p.user.profilePic = absoluteFileUrl(req, p.user.profilePic);
    });
    return res.json({ success: true, posts: allPosts });
  } catch (err) {
    console.error("/posts error:", err);
    return jsonError(res, 500, "Failed to fetch posts");
  }
});

/** PUBLIC POSTS FOR A USER */
app.get("/posts/user/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    if (!collegeId) return jsonError(res, 400, "collegeId required");
    const user = await User.findOne({ collegeId }).select("username profilePic posts collegeId").lean();
    if (!user) return jsonError(res, 404, "User not found");
    const posts = (user.posts || []).map((p) => ({ ...p, image: p.image ? absoluteFileUrl(req, p.image) : null }));
    return res.json({
      success: true,
      user: { username: user.username, profilePic: user.profilePic ? absoluteFileUrl(req, user.profilePic) : null },
      posts,
    });
  } catch (err) {
    console.error("/posts/user error:", err);
    return jsonError(res, 500, "Failed to fetch user posts");
  }
});

/** SEARCH: users + posts */
app.get("/search", async (req, res) => {
  const q = (req.query.query || "").toString().trim();
  if (!q) return res.json({ users: [], posts: [] });

  try {
    // escape query text
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const users = await User.find({
      $or: [{ collegeId: regex }, { username: regex }, { bio: regex }],
    })
      .limit(10)
      .select("collegeId username bio profilePic")
      .lean();

    const usersWithMatchingPosts = await User.find({ "posts.caption": regex })
      .select("username profilePic posts")
      .limit(20)
      .lean();

    const posts = [];
    for (const u of usersWithMatchingPosts) {
      const matched = (u.posts || []).filter((p) => regex.test(p.caption || ""));
      for (const p of matched) {
        posts.push({
          id: p._id ?? `${u._id}-${Math.random().toString(36).slice(2, 8)}`,
          caption: p.caption,
          mediaUrl: p.image && p.image.startsWith("/uploads/") ? absoluteFileUrl(req, p.image) : p.image || null,
          author: {
            username: u.username,
            profilePic: u.profilePic ? (u.profilePic.startsWith("/uploads/") ? absoluteFileUrl(req, u.profilePic) : u.profilePic) : null,
          },
          createdAt: p.createdAt,
        });
      }
    }

    return res.json({ users, posts });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ users: [], posts: [] });
  }
});

/** MESSAGING & CHATS */
app.post("/chats/ensure", auth, async (req, res) => {
  try {
    const { withUserId } = req.body || {};
    if (!withUserId) return jsonError(res, 400, "withUserId required");

    let chat = await Chat.findOne({ participants: { $all: [req.user._id, withUserId] } });
    if (!chat) chat = await Chat.create({ participants: [req.user._id, withUserId], lastMessage: "" });
    return res.json({ success: true, chat });
  } catch (err) {
    console.error("Ensure chat error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

app.get("/chats", auth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .sort({ updatedAt: -1 })
      .populate("participants", "username profilePic collegeId")
      .lean();

    const withMeta = await Promise.all(
      chats.map(async (chat) => {
        const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 }).lean();
        const unread = await Message.countDocuments({ chatId: chat._id, receiver: req.user._id, seen: false }).catch(() => 0);
        return {
          ...chat,
          lastMessage: lastMsg?.text || chat.lastMessage || "",
          lastMessageAt: lastMsg?.createdAt || chat.updatedAt,
          unread,
        };
      })
    );

    return res.json({ success: true, chats: withMeta });
  } catch (err) {
    console.error("List chats error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

app.get("/chats/online", auth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id }).select("participants").lean();
    const partnerIds = new Set();
    chats.forEach((c) => c.participants.forEach((pid) => { const id = pid.toString(); if (id !== req.user._id.toString()) partnerIds.add(id); }));
    const onlineIds = [...onlineUsers.keys()].filter((id) => partnerIds.has(id));
    const users = await User.find({ _id: { $in: onlineIds } }).select("username profilePic collegeId").lean();
    return res.json({ success: true, online: users });
  } catch (err) {
    console.error("Online friends error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

app.post("/messages", auth, async (req, res) => {
  try {
    const { chatId, receiver, text } = req.body || {};
    if (!chatId || !receiver || !text || !text.toString().trim()) return jsonError(res, 400, "chatId, receiver, text required");

    const sanitized = text.toString().trim();
    const msg = await Message.create({ chatId, sender: req.user._id, receiver, text: sanitized });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: sanitized, updatedAt: new Date() });

    io.to(receiver.toString()).emit("message:new", msg);
    io.to(req.user._id.toString()).emit("message:new", msg);

    io.to(receiver.toString()).emit("chat:updated", { chatId, lastMessage: sanitized, at: msg.createdAt });
    io.to(req.user._id.toString()).emit("chat:updated", { chatId, lastMessage: sanitized, at: msg.createdAt });

    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    console.error("Send Message Error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

app.get("/messages/:chatId", auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;

    const q = { chatId };
    if (before) q.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 50, 100)).lean();
    return res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    console.error("Get Messages Error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

app.put("/messages/:chatId/seen", auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await Message.updateMany({ chatId, receiver: req.user._id, seen: false }, { $set: { seen: true } });
    const modified = result?.modifiedCount ?? result?.nModified ?? 0;
    return res.json({ success: true, updated: modified });
  } catch (err) {
    console.error("Mark As Seen Error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/* =============================
   Upload serving (gated)
   ============================= */
app.get("/uploads/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || typeof filename !== "string") return jsonError(res, 400, "filename required");
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return jsonError(res, 400, "Invalid filename");

    const fullPath = path.join(uploadsDir, path.basename(filename));
    if (!fs.existsSync(fullPath)) return jsonError(res, 404, "File not found");

    if (!allowPublicUploads) {
      try {
        const token = extractTokenFromRequest(req);
        if (!token) return res.status(401).json({ success: false, message: "Authentication required to access uploads" });
        if (useRedis) {
          const black = await redisClient.get(`blacklist:${token}`);
          if (black) return res.status(401).json({ success: false, message: "Token revoked" });
        } else {
          if (inMemoryBlacklist.has(token)) return res.status(401).json({ success: false, message: "Token revoked" });
        }
        jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }
    }

    res.setHeader("Cache-Control", "public, max-age=604800");
    return res.sendFile(fullPath);
  } catch (err) {
    console.error("Serve upload error:", err);
    return jsonError(res, 500, "Failed to serve file");
  }
});

/* =============================
   404 + global error handler
   ============================= */
app.use((req, res) => res.status(404).json({ success: false, message: "API route not found" }));

app.use((err, req, res, _next) => {
  console.error("Unhandled server error:", err);
  if (res.headersSent) return;
  if (err instanceof multer.MulterError) return res.status(400).json({ success: false, message: err.message });
  if (isProd) return res.status(500).json({ success: false, message: "Internal Server Error" });
  return res.status(500).json({ success: false, message: err?.message || "Internal Server Error" });
});

/* =============================
   START SERVER
   ============================= */
server.listen(Number(PORT) || 3000, HOST, () => {
  console.log(`✅ Server running at http://${HOST}:${PORT} (${NODE_ENV})`);
});
