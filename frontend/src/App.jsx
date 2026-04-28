import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Menu, Search, LayoutGrid, Folder, Settings, Bell, Sun, 
  FileText, Edit2, Share, Star, MoreHorizontal, Bot, 
  Copy, RotateCcw, Lightbulb, Globe, Code, GraduationCap, 
  Paperclip, Mic, Send, Bookmark, Gift, Wrench, DollarSign, Flag, HelpCircle, Plus, Trash2, Share2, X
} from "lucide-react";

function App() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // ✅ NEW: Image States
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null); // Reference for hidden file input

  const activeChat = chats.find(c => c._id === activeChatId) || chats.find(c => c._id === "temp") || null;

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get("http://localhost:5000/chats");
        if (res.data.length > 0) {
          setChats(res.data);
          setActiveChatId(res.data[0]._id);
        } else {
          createNewChat();
        }
      } catch (err) {
        console.error("Failed to load chats:", err);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, isTyping]);

  const createNewChat = () => {
    if (chats.some(c => c._id === "temp")) {
      setActiveChatId("temp");
      return;
    }
    const newChat = { _id: "temp", title: "New Chat", messages: [] };
    setChats([newChat, ...chats]);
    setActiveChatId("temp");
    clearImage();
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation(); 
    const updatedChats = chats.filter(chat => chat._id !== id);
    setChats(updatedChats);
    if (activeChatId === id) {
      if (updatedChats.length > 0) setActiveChatId(updatedChats[0]._id);
      else createNewChat();
    }
    if (id !== "temp") {
      try { await axios.delete(`http://localhost:5000/chat/${id}`); } catch (err) {}
    }
  };

  // ✅ NEW: Image File Handler
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview UI
    setImagePreview(URL.createObjectURL(file));
    setMimeType(file.type);

    // Convert to Base64 to send to API
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setMimeType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() && !imageBase64) return;

    const userMsg = message;
    const currentBase64 = imageBase64;
    const currentMimeType = mimeType;
    
    setMessage("");
    clearImage(); // Clear input UI immediately

    setChats(prevChats => prevChats.map(chat => {
      if (chat._id === activeChatId) {
        const visualMsg = currentBase64 ? `[Image Attached] 🖼️\n${userMsg}` : userMsg;
        return {
          ...chat,
          title: chat.messages.length === 0 ? (userMsg.substring(0, 25) || "Image Analysis") : chat.title,
          messages: [...chat.messages, { role: "user", text: visualMsg }]
        };
      }
      return chat;
    }));

    setIsTyping(true);

    try {
      const res = await axios.post("http://localhost:5000/chat", { 
        message: userMsg, 
        chatId: activeChatId === "temp" ? null : activeChatId,
        imageBase64: currentBase64,
        mimeType: currentMimeType
      });

      const updatedDBChat = res.data;
      setChats(prevChats => prevChats.map(chat => chat._id === activeChatId ? updatedDBChat : chat));
      setActiveChatId(updatedDBChat._id); 

    } catch (err) {
      console.error(err);
      setChats(prevChats => prevChats.map(chat => {
        if (chat._id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: "⚠️ **Error:** Failed to connect to NEO-Z." }] };
        }
        return chat;
      }));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#121312] text-gray-300 flex font-sans overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <div className="w-[300px] bg-[#0d0e0d] border-r border-white/5 flex flex-col p-4 shrink-0">
        <div className="flex items-center justify-between mb-8 px-2 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#A3F58F] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(163,245,143,0.3)]">
              <div className="w-3.5 h-3.5 bg-[#121312] rounded-sm rotate-45"></div>
            </div>
            <h2 className="text-white font-bold text-xl tracking-tighter">NEO-Z</h2>
          </div>
          <button className="text-gray-500 hover:text-white transition-colors"><Menu size={20} /></button>
        </div>

        <button onClick={createNewChat} className="w-full bg-[#A3F58F] text-[#121312] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mb-8 hover:bg-[#8ee07a] transition-all hover:scale-[0.98]">
          <Plus size={20} strokeWidth={3} /> New Chat
        </button>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[2px] mb-4 px-2">History</p>
          <div className="space-y-1.5">
            {chats.map(chat => (
              <div key={chat._id} onClick={() => setActiveChatId(chat._id)} className={`group flex items-center justify-between text-sm px-3 py-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-white/10 border border-white/5 shadow-lg" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                <div className="flex items-center gap-3 truncate">
                  <FileText size={14} className={activeChatId === chat._id ? "text-[#A3F58F]" : "text-gray-600"} />
                  <span className="truncate font-medium">{chat.title}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${activeChatId === chat._id ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}>
                  <button className="p-1.5 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-all"><Share2 size={12} /></button>
                  <button onClick={(e) => deleteChat(e, chat._id)} className="p-1.5 hover:bg-red-500/10 rounded-md text-gray-500 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 px-2 pt-4 border-t border-white/5 text-gray-500">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">Z</div>
          <div className="flex flex-col"><span className="text-white text-xs font-bold">User Zaid</span><span className="text-[10px]">Free Tier</span></div>
          <button className="hover:text-white ml-auto"><Bell size={18} /></button>
        </div>
      </div>

      {/* 2. MAIN AREA */}
      <div className="flex-1 flex flex-col relative bg-[#121312]">
        
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3 text-white">
            <span className="text-[#A3F58F] font-bold text-xs bg-[#A3F58F]/10 px-2 py-0.5 rounded border border-[#A3F58F]/20">v2.5</span>
            <span className="text-sm font-medium opacity-60">/ {activeChat?.title}</span>
          </div>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5 transition-all text-white"><Share size={14} /> SHARE</button>
             <button className="w-9 h-9 flex items-center justify-center text-gray-400 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5">⭐</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          {(!activeChat || activeChat.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center p-6">
               <div className="mb-10 animate-pulse">
                  <div className="w-40 h-40 bg-[#A3F58F]/5 rounded-full flex items-center justify-center border border-[#A3F58F]/10">
                    <Bot size={80} className="text-[#A3F58F] opacity-80" />
                  </div>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">What's the plan, Zaid?</h1>
               <p className="text-gray-500 text-lg mb-12">I'm NEO-Z, your upgraded intelligence partner.</p>
            </div>
          ) : (
            <div className="p-6 lg:p-10 space-y-8 max-w-4xl mx-auto w-full">
               {activeChat.messages.map((c, i) => (
                 <div key={i} className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} w-full`}>
                   <div className="flex items-start gap-4 w-full">
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${c.role === 'user' ? 'bg-indigo-600 order-last' : 'bg-[#A3F58F] text-[#121312]'}`}>
                        {c.role === 'user' ? 'U' : 'NZ'}
                      </div>
                      <div className={`flex-1 text-sm leading-relaxed ${c.role === 'user' ? 'text-right pr-4' : 'text-left pl-4'}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                           p: ({node, ...props}) => <p className="mb-4 last:mb-0 whitespace-pre-line" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                           code: ({node, inline, children, ...props}) => !inline ? (
                            <div className="w-full bg-black/40 border border-white/5 rounded-xl overflow-hidden my-4">
                              <pre className="p-5 overflow-x-auto text-gray-300">{children}</pre>
                            </div>
                           ) : <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#A3F58F]" {...props}>{children}</code>
                        }}>
                          {c.text}
                        </ReactMarkdown>
                      </div>
                   </div>
                 </div>
               ))}
               {isTyping && <div className="text-[#A3F58F] text-xs font-bold animate-pulse ml-12">NEO-Z IS ANALYZING...</div>}
               <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 pt-0 max-w-4xl mx-auto w-full">
          <form onSubmit={sendMessage} className="bg-[#1A1C1B] rounded-[22px] border border-white/5 p-2 shadow-2xl flex flex-col focus-within:border-[#A3F58F]/30 transition-all">
            
            {/* ✅ NEW: Image Preview Box */}
            {imagePreview && (
              <div className="relative ml-4 mt-2 inline-block">
                <img src={imagePreview} alt="Upload Preview" className="h-16 w-16 object-cover rounded-xl border border-white/10 shadow-lg" />
                <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1 border border-white/20 hover:bg-red-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}

            <input
              className="w-full bg-transparent text-gray-200 px-5 py-4 outline-none placeholder:text-gray-600 text-base"
              placeholder="Command NEO-Z..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            
            {/* Hidden File Input */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

            <div className="flex items-center justify-between px-3 pb-2 mt-1">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-4">
                <button type="button" className="text-[10px] font-black text-gray-400 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:text-white transition-all uppercase tracking-wider"><Lightbulb size={12}/> Brainstorm</button>
                <button type="button" className="text-[10px] font-black text-gray-400 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:text-white transition-all uppercase tracking-wider"><Code size={12}/> Code</button>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                
                {/* ✅ FIX: Paperclip Button triggers file upload */}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white transition-colors">
                  <Paperclip size={18} />
                </button>
                
                <button type="submit" disabled={!message.trim() && !imageBase64} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${(message.trim() || imageBase64) ? "bg-[#A3F58F] text-[#121312] hover:scale-105" : "bg-white/5 text-gray-600"}`}>
                  <Send size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          </form>
          <p className="text-[10px] text-center text-gray-600 mt-4 font-bold tracking-widest uppercase">Powered by Gemini 2.5 Flash Engine</p>
        </div>
      </div>

      {/* 3. RIGHT MINI SIDEBAR */}
      <div className="w-[70px] bg-[#0d0e0d] border-l border-white/5 flex flex-col items-center py-8 gap-6 text-gray-500 shrink-0">
        <button className="hover:text-[#A3F58F] transition-colors"><Bookmark size={20} /></button>
        <button className="hover:text-[#A3F58F] transition-colors"><Wrench size={20} /></button>
        <button className="hover:text-[#A3F58F] transition-colors"><DollarSign size={20} /></button>
        <div className="mt-auto flex flex-col gap-6">
          <button className="hover:text-white"><Settings size={20} /></button>
          <button className="hover:text-white"><HelpCircle size={20} /></button>
        </div>
      </div>
    </div>
  );
}

export default App;