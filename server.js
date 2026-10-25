"use strict";

require("dotenv").config();
const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { rateLimit } = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 1. BASIC QUOTE COLLECTION
// Search works against this curated collection.
// ZenQuotes is used separately for fresh quotes.
// ==========================================

const quotes = [
  { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt", tags: ["motivation", "success"] },
  { q: "Your only limit is your mind.", a: "Unknown", tags: ["motivation", "mindset"] },
  { q: "Dream big. Start small. Act now.", a: "Unknown", tags: ["dreams", "success"] },
  { q: "Turn your wounds into wisdom.", a: "Oprah Winfrey", tags: ["life", "wisdom"] },
  { q: "Every moment is a fresh beginning.", a: "T. S. Eliot", tags: ["life", "hope"] },
  { q: "Happiness depends upon ourselves.", a: "Aristotle", tags: ["happiness", "life"] },
  { q: "The secret of getting ahead is getting started.", a: "Mark Twain", tags: ["motivation", "success"] },
  { q: "Small steps every day lead to big changes.", a: "Unknown", tags: ["habits", "success"] },
  { q: "Believe in yourself and all that you are.", a: "Christian D. Larson", tags: ["confidence", "motivation"] },
  { q: "Nothing is impossible to a willing heart.", a: "Unknown", tags: ["hope", "motivation"] },
  { q: "Be yourself; everyone else is already taken.", a: "Oscar Wilde", tags: ["confidence", "life"] },
  { q: "It always seems impossible until it's done.", a: "Nelson Mandela", tags: ["success", "motivation"] },
  { q: "The best way out is always through.", a: "Robert Frost", tags: ["courage", "life"] },
  { q: "Wherever you go, go with all your heart.", a: "Confucius", tags: ["life", "happiness"] },
  { q: "Stay hungry. Stay foolish.", a: "Steve Jobs", tags: ["dreams", "success"] }
];

// ==========================================
// 2. MONGODB USER MODEL
// ==========================================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

/* =====================================
   VIBEVERSE — PERSONAL JOURNAL MODEL
===================================== */

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    reflection: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    quote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500
    },
    author: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100
    }
  },
  { timestamps: true }
);

const JournalEntry =
  mongoose.models.JournalEntry ||
  mongoose.model("JournalEntry", journalEntrySchema);

// ==========================================
// 3. SECURITY HELPERS
// ==========================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes."
  }
});

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || ""
  };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account not found. Please log in again."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please log in again."
    });
  }
}

// ==========================================
// 4. HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "VibeVerse backend is running!",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

// ==========================================
// 5. REGISTER
// POST /api/auth/register
// ==========================================

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { name, email, phone = "", password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof phone !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid registration details."
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2 || cleanName.length > 60) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2–60 characters."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    if (cleanEmail.length > 254 || cleanPhone.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number is too long."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8–72 characters."
      });
    }

    if (await User.exists({ email: cleanEmail })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash
    });

    return res.status(201).json({
      success: true,
      message: "Your VibeVerse account has been created!",
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create your account. Please try again."
    });
  }
});

// ==========================================
// 6. LOGIN
// POST /api/auth/login
// ==========================================

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter your email and password."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token: createToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not log in. Please try again."
    });
  }
});

// ==========================================
// 7. GET CURRENT LOGGED-IN USER
// GET /api/auth/me
// ==========================================

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: publicUser(req.user)
  });
});

// ==========================================
// 8. SEARCH QUOTES
// GET /api/search?q=motivation
// ==========================================

app.get("/api/search", (req, res) => {
  const query = typeof req.query.q === "string"
    ? req.query.q.trim().slice(0, 100).toLowerCase()
    : "";

  if (query.length < 2) {
    return res.json({
      success: true,
      results: [],
      message: "Enter at least 2 characters to search."
    });
  }

  const results = quotes
    .filter(item => {
      const searchable = [
        item.q,
        item.a,
        ...item.tags
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    })
    .slice(0, 20)
    .map(item => ({
      quote: item.q,
      author: item.a,
      tags: item.tags
    }));

  res.json({
    success: true,
    count: results.length,
    results
  });
});

// ==========================================
// 9. QUOTE + WALLPAPER API
// Existing frontend endpoint is preserved
// ==========================================

app.get("/api/quote-wallpaper", async (req, res) => {
  let quote =
    quotes[Math.floor(Math.random() * quotes.length)];

  let quoteSource = "VibeVerse quote collection";

  try {
    const response = await fetch(
      "https://zenquotes.io/api/random",
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();

      if (
        Array.isArray(data) &&
        data[0] &&
        typeof data[0].q === "string" &&
        typeof data[0].a === "string" &&
        data[0].q.trim() &&
        data[0].a.trim()
      ) {
        quote = {
          q: data[0].q.trim(),
          a: data[0].a.trim()
        };

        quoteSource = "ZenQuotes API";
      }
    }
  } catch (error) {
    console.log("Using the local quote collection as a backup.");
  }

  const seed = Math.random().toString(36).substring(2, 12);

  res.set("Cache-Control", "no-store");

  res.json({
    success: true,
    quote: quote.q,
    author: quote.a,
    quoteSource,
    wallpaper:
      `https://picsum.photos/seed/${encodeURIComponent(seed)}/1920/1080`,
    wallpaperSource: "Picsum Photos",
    generatedAt: new Date().toISOString()
  });
});

// ==========================================
// 10. RANDOM WALLPAPER ENDPOINT
// ==========================================

app.get("/api/wallpaper", (req, res) => {
  const seed = Math.random().toString(36).substring(2, 12);

  res.set("Cache-Control", "no-store");

  res.json({
    success: true,
    wallpaper:
      `https://picsum.photos/seed/${encodeURIComponent(seed)}/1920/1080`
  });
});

// ==========================================
// 11. RANDOM LOCAL QUOTE ENDPOINT
// ==========================================

app.get("/api/quote", (req, res) => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  res.json({
    success: true,
    quote: quote.q,
    author: quote.a,
    tags: quote.tags
  });
});

/* =====================================
   VIBEVERSE — PERSONAL JOURNAL API
===================================== */

// Get the logged-in user's journal entries
app.get("/api/journal", requireAuth, async (req, res) => {
  try {
    const entries = await JournalEntry.find({
      userId: req.user._id
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, entries });
  } catch (error) {
    console.error("Load journal error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load journal entries."
    });
  }
});

// Save a journal entry
app.post("/api/journal", requireAuth, async (req, res) => {
  try {
    const title =
      typeof req.body.title === "string" ? req.body.title.trim() : "";
    const reflection =
      typeof req.body.reflection === "string"
        ? req.body.reflection.trim()
        : "";
    const quote =
      typeof req.body.quote === "string" ? req.body.quote.trim() : "";
    const author =
      typeof req.body.author === "string" ? req.body.author.trim() : "";

    if (!title || !reflection) {
      return res.status(400).json({
        success: false,
        message: "Title and thoughts are required."
      });
    }

    if (
      title.length > 100 ||
      reflection.length > 3000 ||
      quote.length > 500 ||
      author.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more fields exceed the allowed length."
      });
    }

    const entry = await JournalEntry.create({
      userId: req.user._id,
      title,
      reflection,
      quote,
      author
    });

    res.status(201).json({
      success: true,
      message: "Journal entry saved.",
      entry
    });
  } catch (error) {
    console.error("Save journal error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to save the journal entry."
    });
  }
});

// Delete an entry belonging to the logged-in user
app.delete("/api/journal/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid journal entry ID."
      });
    }

    const entry = await JournalEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found."
      });
    }

    res.json({
      success: true,
      message: "Journal entry deleted."
    });
  } catch (error) {
    console.error("Delete journal error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete the journal entry."
    });
  }
});

// ==========================================
// 12. START SERVER AFTER DATABASE CONNECTS
// ==========================================

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from your .env file.");
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Set JWT_SECRET to a private random value of at least 32 characters.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("✅ MongoDB connected successfully!");

  app.listen(PORT, () => {
    console.log("");
    console.log("✨ VIBEVERSE IS RUNNING ✨");
    console.log(`🌈 Website: http://localhost:${PORT}`);
    console.log(`🔌 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔎 Search: http://localhost:${PORT}/api/search?q=motivation`);
    console.log("");
  });
}

startServer().catch(error => {
  console.error("❌ Could not start VibeVerse:", error.message);
  process.exit(1);
});