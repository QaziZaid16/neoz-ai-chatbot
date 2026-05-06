import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* ================== OPENROUTER ================== */
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/* ================== DB ================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected 🔥"))
  .catch((err) => console.log(err));

/* ================== SCHEMAS ================== */

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
  })
);

const Project = mongoose.model(
  "Project",
  new mongoose.Schema({
    name: String,
    stack: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  })
);

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

const auth = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(400).json({ error: "Invalid token" });
  }
};

/* ================== AUTH ROUTES ================== */

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "User exists" });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hash });

  res.json({ message: "Signup success" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

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

app.get("/projects", auth, async (req, res) => {
  const data = await Project.find({ userId: req.user.id });
  res.json(data);
});

app.post("/projects", auth, async (req, res) => {
  const project = await Project.create({
    ...req.body,
    userId: req.user.id,
  });
  res.json(project);
});

/* ================== CHATS ================== */

app.get("/chats", auth, async (req, res) => {
  const chats = await Chat.find({ userId: req.user.id });
  res.json(chats);
});

/* ================== MAIN CHAT ================== */

app.post("/chat", auth, async (req, res) => {
  const { message, chatId, projectId } = req.body;

  if (!message) return res.status(400).json({ error: "Message required" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let chat;

    if (chatId) {
      chat = await Chat.findById(chatId);
    }

    if (!chat) {
      chat = new Chat({
        title: message.slice(0, 30),
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

    // add user message
    chat.messages.push({ role: "user", text: message });
    await chat.save();

    // send chat immediately
    res.write(`data: ${JSON.stringify({ init: true, chat })}\n\n`);

    /* ================== GEMMA CALL ================== */

    const completion = await openai.chat.completions.create({
      model: "google/gemma-2-27b-it",
      messages: [...history, { role: "user", content: message }],
    });

    const reply = completion.choices[0].message.content;

    // send response
    res.write(`data: ${JSON.stringify({ chunk: reply })}\n\n`);

    // save bot reply
    chat.messages.push({ role: "bot", text: reply });
    await chat.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: "AI error ❌" })}\n\n`);
    res.end();
  }
});

/* ================== DELETE ================== */

app.delete("/chat/:id", auth, async (req, res) => {
  await Chat.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================== PUBLIC ================== */

app.get("/chat/:id", async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  res.json(chat);
});

/* ================== SERVER ================== */

app.listen(5000, () => {
  console.log("Server running 🚀");
});