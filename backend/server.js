import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
// ✅ FIX: Image uploads ke liye payload limit badhani padti hai
app.use(express.json({ limit: '50mb' })); 

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is missing!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Mongo Connection
mongoose.connect("mongodb://127.0.0.1:27017/neoz-chatbot")
  .then(() => console.log("MongoDB connected 🔥"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const ChatSchema = new mongoose.Schema({
  title: { type: String, default: "New Chat" },
  messages: [{ role: String, text: String }],
  createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model("Chat", ChatSchema);

app.get("/chats", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

app.post("/chat", async (req, res) => {
  // ✅ FIX: Frontend se ab imageBase64 aur mimeType bhi aayega
  const { message, chatId, imageBase64, mimeType } = req.body;

  if (!message && !imageBase64) return res.status(400).json({ error: "Message or image is required" });

  try {
    let chat;
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      chat = await Chat.findById(chatId);
    }
    
    if (!chat) {
      chat = new Chat({ 
        title: message ? message.substring(0, 30) : "Image Upload", 
        messages: [] 
      });
    }

    // Database mein save karne ke liye message string
    const userMsgToSave = imageBase64 ? `[Image Attached] 🖼️\n${message}` : message;
    chat.messages.push({ role: "user", text: userMsgToSave });

    // AI Generation (Gemini 2.5 Flash is Multimodal)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Ya "gemini-1.5-flash"
    
    const chatSession = model.startChat({
      history: chat.messages.slice(0, -1).map(m => ({
        role: m.role === 'bot' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }))
    });

    // ✅ FIX: Agar Image hai, toh Payload format change hoga
    let messageParts = [];
    if (imageBase64) {
       messageParts.push({
         inlineData: {
           data: imageBase64.split(',')[1], // Base64 header remove karna
           mimeType: mimeType || "image/jpeg"
         }
       });
    }
    if (message) {
      messageParts.push({ text: message });
    }

    // Gemini ko Multimodal Part bhejna
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

app.delete("/chat/:id", async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.listen(5000, () => console.log("Server running 🚀 on port 5000"));