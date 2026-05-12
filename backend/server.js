import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Create the Express app and enable JSON/CORS parsing for browser clients.
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Read environment variables used by the database and AI providers.
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it";

if (!MONGO_URI || !process.env.JWT_SECRET || !OPENROUTER_API_KEY) {
  console.error("❌ Missing required env vars: MONGO_URI/MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY");
}

// OpenRouter handles text generation, Gemini handles image analysis.
const openrouter = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "NEO-Z AI Chatbot",
  },
});
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
console.log("🟢 Backend booting with model:", OPENROUTER_MODEL);

/* ================== DB ================== */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🟢 MongoDB Connected 🔥"))
  .catch((err) => console.error("🔴 MongoDB connection failed:", err));

/* ================== SCHEMAS ================== */
// Users store authentication credentials.

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
  })
);

// Projects group chats under a shared workspace label.
const Project = mongoose.model(
  "Project",
  new mongoose.Schema({
    name: String,
    stack: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  })
);

// Chats store the conversation history for each user/project pair.
const Chat = mongoose.model(
  "Chat",
  new mongoose.Schema({
    title: { type: String, default: "New Chat" },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    messages: [{ role: String, text: String }],
    createdAt: { type: Date, default: Date.now },
  })
);

/* ================== AUTH ================== */
// Verify bearer tokens before allowing access to protected routes.

const auth = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = decoded;
    console.log("🔐 Authenticated request for user:", req.user.id);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* ================== AUTH ROUTES ================== */

// Register a new user account.
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("🆕 Signup attempt:", { email, name });

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "User exists" });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hash });

  res.json({ message: "Signup success" });
});

// Log in an existing user and issue a JWT.
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("🔑 Login attempt:", { email });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({
    token,
    user: { id: user._id, name: user.name },
  });
});

/* ================== PROJECT ================== */

// Return the authenticated user's projects.
app.get("/projects", auth, async (req, res) => {
  console.log("📁 Fetching projects for user:", req.user.id);
  const data = await Project.find({ userId: req.user.id });
  res.json(data);
});

// Create a new project for the current user.
app.post("/projects", auth, async (req, res) => {
  console.log("📁 Creating project:", req.body);
  const project = await Project.create({
    ...req.body,
    userId: req.user.id,
  });
  res.json(project);
});

/* ================== CHATS ================== */

// Return the authenticated user's chat list.
app.get("/chats", auth, async (req, res) => {
  console.log("💬 Fetching chats for user:", req.user.id);
  const chats = await Chat.find({ userId: req.user.id });
  res.json(chats);
});

/* ================== MAIN CHAT ================== */

// Stream AI responses for text or image prompts.
app.post("/chat", auth, async (req, res) => {
  const { message, chatId, projectId, imageBase64, mimeType } = req.body;
  console.log("🧠 Incoming chat request:", {
    chatId,
    projectId,
    hasText: !!message,
    hasImage: !!imageBase64,
  });

  if (!message && !imageBase64) return res.status(400).json({ error: "Message or image required" });

  // SSE headers keep the response open so chunks can stream to the browser.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let chat;

    if (chatId) {
      chat = await Chat.findById(chatId);
      if (chat && chat.userId.toString() !== req.user.id) {
        console.warn("🚫 Unauthorized chat access blocked:", { chatId, userId: req.user.id });
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    if (!chat) {
      console.log("🧾 Creating new chat thread");
      chat = new Chat({
        title: (message || "Image Upload").slice(0, 30),
        userId: req.user.id,
        projectId: projectId || null,
        messages: [],
      });
    }

    // history
    const history = chat.messages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));
    console.log("🧵 History messages count:", history.length);

    // add user message
    chat.messages.push({ role: "user", text: imageBase64 ? `[Image Attached] 🖼️\n${message || ""}` : message });
    await chat.save();
    console.log("💾 Saved user message to chat:", chat._id);

    // send chat immediately
    res.write(`data: ${JSON.stringify({ init: true, chat })}\n\n`);

    let reply = "";

    if (imageBase64) {
      console.log("🖼️ Routing to Gemini for image analysis");
      if (!genAI) {
        throw new Error("GEMINI_API_KEY is missing for image analysis");
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const chatSession = model.startChat({
        history: history.map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
      });

      const parts = [
        { inlineData: { data: imageBase64.split(",")[1], mimeType: mimeType || "image/jpeg" } },
      ];
      if (message) parts.push({ text: message });

      const result = await chatSession.sendMessageStream(parts);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        reply += chunkText;
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      }
    } else {
      console.log("✍️ Routing to OpenRouter text model:", OPENROUTER_MODEL);
      const completion = await openrouter.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages: [...history, { role: "user", content: message }],
        stream: true,
      });

      for await (const chunk of completion) {
        const chunkText = chunk.choices[0]?.delta?.content || "";
        if (chunkText) {
          reply += chunkText;
          res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
        }
      }
    }

    // save bot reply
    chat.messages.push({ role: "bot", text: reply });
    await chat.save();
    console.log("✅ Saved assistant reply for chat:", chat._id);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error("🔴 Chat route failed:", err);
    res.write(`data: ${JSON.stringify({ error: err.message || "AI error ❌" })}\n\n`);
    res.end();
  }
});

/* ================== DELETE ================== */

// Delete a chat owned by the authenticated user.
app.delete("/chat/:id", auth, async (req, res) => {
  console.log("🗑️ Deleting chat:", req.params.id);
  await Chat.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================== PUBLIC ================== */

// Fetch a public/shared chat thread by id.
app.get("/chat/:id", async (req, res) => {
  console.log("🔎 Fetching public chat:", req.params.id);
  const chat = await Chat.findById(req.params.id);
  res.json(chat);
});

/* ================== SERVER ================== */

// Start the API server.
app.listen(5000, () => {
  console.log("🟢 Server running 🚀 on port 5000");
});