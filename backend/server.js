import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

if (!process.env.GEMINI_API_KEY || !process.env.JWT_SECRET) {
  console.error("❌ ERROR: Missing API KEY or JWT_SECRET in .env!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Cloud MongoDB Atlas Connected 🔥🚀"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ================= SCHEMAS =================

// 1. Naya User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model("User", UserSchema);

// 2. Project Schema (Ab User se link hoga)
const ProjectSchema = new mongoose.Schema({
  name: String,
  stack: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Added User ID
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model("Project", ProjectSchema);

// 3. Chat Schema (Ab User se link hoga)
const ChatSchema = new mongoose.Schema({
  title: { type: String, default: "New Chat" },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Added User ID
  messages: [{ role: String, text: String }],
  createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model("Chat", ChatSchema);

// ================= MIDDLEWARE =================
// Yeh check karega ki user ke paas valid entry pass (Token) hai ya nahi
const authenticate = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Access Denied. Login Required." });

  try {
    const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = verified; // Verified user ka ID req.user mein daal diya
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

// ================= AUTH ROUTES =================

// Signup Route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.json({ message: "User registered successfully! Please login." });
  } catch (err) {
    res.status(500).json({ error: "Signup Failed" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid Password" });

    // Create JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Login Failed" });
  }
});

// ================= APP ROUTES (Protected with `authenticate`) =================

app.get("/", (req, res) => {
  res.send("<h1>NEO-Z API with Auth is running smoothly 🚀</h1>");
});

// Fetch user-specific Projects
app.get("/projects", authenticate, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Create Project
app.post("/projects", authenticate, async (req, res) => {
  const { name, stack } = req.body;
  try {
    const project = await Project.create({ name, stack, userId: req.user.id });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Fetch user-specific Chats
app.get("/chats", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Main Chat Route
app.post("/chat", authenticate, async (req, res) => {
  const { message, chatId, projectId, imageBase64, mimeType } = req.body;

  if (!message && !imageBase64) return res.status(400).json({ error: "Message or image is required" });

  try {
    let chat;
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      chat = await Chat.findById(chatId);
      // Security check: Make sure this chat belongs to the user
      if(chat.userId.toString() !== req.user.id) return res.status(403).json({error: "Unauthorized"});
    }
    
    if (!chat) {
      chat = new Chat({ 
        title: message ? message.substring(0, 30) : "Image Upload", 
        projectId: projectId || null,
        userId: req.user.id, // Assign to logged-in user
        messages: [] 
      });
    }

    let sharedHistory = [];
    if (chat.projectId) {
      const projectChats = await Chat.find({ projectId: chat.projectId, userId: req.user.id }).sort({ createdAt: 1 });
      projectChats.forEach(c => {
        c.messages.forEach(m => {
          sharedHistory.push({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.text }] });
        });
      });
    } else if (chat.messages.length > 0) {
      sharedHistory = chat.messages.map(m => ({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.text }] }));
    }

    const visualMsg = imageBase64 ? `[Image Attached] 🖼️\n${message}` : message;
    chat.messages.push({ role: "user", text: visualMsg });

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); 
    const chatSession = model.startChat({ history: sharedHistory });

    let messageParts = [];
    if (imageBase64) messageParts.push({ inlineData: { data: imageBase64.split(',')[1], mimeType: mimeType || "image/jpeg" } });
    if (message) messageParts.push({ text: message });

    const result = await chatSession.sendMessage(messageParts);
    chat.messages.push({ role: "bot", text: result.response.text() });
    await chat.save();

    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: "Gemini error ❌" });
  }
});

// Delete Chat
app.delete("/chat/:id", authenticate, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ✅ Public route for Shared Links (No auth required)
app.get("/chat/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: "Invalid Link" });
  }
});

app.listen(5000, () => console.log("Server running 🚀 on port 5000"));