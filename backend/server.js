import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
// Image handle karne ke liye 50mb limit
app.use(express.json({ limit: '50mb' })); 

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is missing!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Cloud MongoDB Atlas Connected 🔥🚀"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- SCHEMAS ---
const ProjectSchema = new mongoose.Schema({
  name: String,
  stack: String,
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model("Project", ProjectSchema);

const ChatSchema = new mongoose.Schema({
  title: { type: String, default: "New Chat" },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  messages: [{ role: String, text: String }],
  createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model("Chat", ChatSchema);

// --- ROUTES ---

// 1. Fetch Projects
app.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// 2. Create Project
app.post("/projects", async (req, res) => {
  const { name, stack } = req.body;
  try {
    const project = await Project.create({ name, stack });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// 3. Fetch All Chats
app.get("/chats", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// 4. Main Chat Route (With Context & Vision)
app.post("/chat", async (req, res) => {
  const { message, chatId, projectId, imageBase64, mimeType } = req.body;

  if (!message && !imageBase64) return res.status(400).json({ error: "Message or image is required" });

  try {
    let chat;
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      chat = await Chat.findById(chatId);
    }
    
    if (!chat) {
      chat = new Chat({ 
        title: message ? message.substring(0, 30) : "Image Upload", 
        projectId: projectId || null,
        messages: [] 
      });
    }

    // 🧠 SHARED MEMORY LOGIC 🧠
    let sharedHistory = [];
    if (chat.projectId) {
      // Agar project hai, toh us project ki saari chats utha lo
      const projectChats = await Chat.find({ projectId: chat.projectId }).sort({ createdAt: 1 });
      projectChats.forEach(c => {
        c.messages.forEach(m => {
          sharedHistory.push({
            role: m.role === 'bot' ? 'model' : 'user',
            parts: [{ text: m.text }]
          });
        });
      });
    } else if (chat.messages.length > 0) {
      // Normal chat history
      sharedHistory = chat.messages.map(m => ({
        role: m.role === 'bot' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
    }

    // Save current user message
    const visualMsg = imageBase64 ? `[Image Attached] 🖼️\n${message}` : message;
    chat.messages.push({ role: "user", text: visualMsg });

    // Use Gemini 1.5 Flash to avoid API limits!
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    const chatSession = model.startChat({ history: sharedHistory });

    let messageParts = [];
    if (imageBase64) {
       messageParts.push({ inlineData: { data: imageBase64.split(',')[1], mimeType: mimeType || "image/jpeg" } });
    }
    if (message) messageParts.push({ text: message });

    const result = await chatSession.sendMessage(messageParts);
    const botReply = result.response.text();

    chat.messages.push({ role: "bot", text: botReply });
    await chat.save();

    res.json(chat);
  } catch (err) {
    console.error("❌ GEMINI API ERROR:", err.message); 
    res.status(500).json({ error: "Gemini error ❌" });
  }
});

// 5. Delete Chat
app.delete("/chat/:id", async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.listen(5000, () => console.log("Server running 🚀 on port 5000"));