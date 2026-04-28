import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Menu, Settings, Bell, FileText, Share, Star, 
  Bot, Code, Lightbulb, Paperclip, Mic, Send, Bookmark, Wrench, DollarSign, 
  HelpCircle, Plus, Trash2, Share2, X, Folder, FolderOpen, ChevronRight, LogOut, Mail, Lock, User
} from "lucide-react";

// 🔴 LIVE BACKEND URL 🔴
const API_BASE_URL = "https://neoz-ai-chatbot.onrender.com";

// Load initial token
const initialToken = localStorage.getItem("token");
if (initialToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}

function App() {
  // ✅ AUTH STATES
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [authMode, setAuthMode] = useState("login"); // "login" or "signup"
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // APP STATES
  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // SHARE VIEW STATE
  const urlParams = new URLSearchParams(window.location.search);
  const sharedChatId = urlParams.get('share');
  const [isSharedView, setIsSharedView] = useState(!!sharedChatId);

  // MODAL STATES
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // IMAGE STATES
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeChat = chats.find(c => c._id === activeChatId) || chats.find(c => c._id === "temp") || null;

  // ✅ HANDLE LOGIN / SIGNUP
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/signup";
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, authForm);
      
      if (authMode === "signup") {
         alert("Signup Successful! Please login with your new account.");
         setAuthMode("login");
         setAuthForm({ ...authForm, password: "" }); // Clear password
      } else {
         // Login Success
         const newToken = res.data.token;
         const userData = res.data.user;
         
         setToken(newToken);
         setUser(userData);
         localStorage.setItem("token", newToken);
         localStorage.setItem("user", JSON.stringify(userData));
         axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || "Authentication failed. Try again.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ✅ HANDLE LOGOUT
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setChats([]);
    setProjects([]);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  // FETCH DATA ON LOAD
  useEffect(() => {
    const fetchData = async () => {
      // 1. Shared View (No Auth Needed)
      if (isSharedView) {
        try {
          const res = await axios.get(`${API_BASE_URL}/chat/${sharedChatId}`);
          setChats([res.data]);
          setActiveChatId(res.data._id);
        } catch (err) {
          alert("Yeh link expire ho chuka hai ya invalid hai!");
          window.location.href = "/"; 
        }
        return; 
      }

      // 2. Normal View (Needs Auth)
      if (token) {
        try {
          const projRes = await axios.get(`${API_BASE_URL}/projects`);
          setProjects(projRes.data);

          const chatRes = await axios.get(`${API_BASE_URL}/chats`);
          const fetchedChats = chatRes.data || [];
          
          const tempChat = { _id: "temp", title: "New Chat", projectId: null, messages: [] };
          setChats([tempChat, ...fetchedChats]);
          setActiveChatId("temp");
        } catch (err) {
          console.error("Failed to load data:", err);
          if(err.response?.status === 401) handleLogout(); // Invalid token fallback
        }
      }
    };
    fetchData();
  }, [isSharedView, sharedChatId, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, isTyping]);

  const copyShareLink = (id) => {
    if(id === "temp") return alert("Pehle message bhej kar chat start karo, phir share kar sakte ho!");
    navigator.clipboard.writeText(`${window.location.origin}/?share=${id}`);
    alert("Shareable Link Copied! 🚀");
  };

  const createNewChat = (projectId = null) => {
    const filteredChats = chats.filter(c => c._id !== "temp"); 
    const newChat = { _id: "temp", title: "New Chat", projectId: projectId, messages: [] };
    setChats([newChat, ...filteredChats]);
    setActiveChatId("temp");
    if(projectId) setActiveProjectId(projectId);
    clearImage();
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if(!newProjectName.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/projects`, { name: newProjectName, stack: "General" });
      setProjects([res.data, ...projects]);
      setIsProjectModalOpen(false);
      setNewProjectName("");
      setActiveProjectId(res.data._id);
    } catch(err) { console.error(err); }
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
      try { await axios.delete(`${API_BASE_URL}/chat/${id}`); } catch (err) {}
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result);
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
    const currentProjectId = activeChat?.projectId || null;
    
    setMessage("");
    clearImage(); 

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
      const res = await axios.post(`${API_BASE_URL}/chat`, { 
        message: userMsg, 
        chatId: activeChatId === "temp" ? null : activeChatId,
        projectId: currentProjectId,
        imageBase64: currentBase64,
        mimeType: currentMimeType
      });

      const updatedDBChat = res.data;
      setChats(prevChats => {
        const filtered = prevChats.filter(c => c._id !== "temp" && c._id !== activeChatId);
        return [updatedDBChat, ...filtered];
      });
      setActiveChatId(updatedDBChat._id); 

    } catch (err) {
      console.error(err);
      if(err.response?.status === 401) handleLogout(); // Kicked out if token expires
      setChats(prevChats => prevChats.map(chat => {
        if (chat._id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: "⚠️ **Error:** Request failed." }] };
        }
        return chat;
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const projectChats = chats.filter(c => c.projectId !== null && c._id !== "temp");
  const standaloneChats = chats.filter(c => c.projectId === null && c._id !== "temp");

  // ==========================================
  // 🟢 RENDER: AUTHENTICATION SCREEN
  // ==========================================
  if (!token && !isSharedView) {
    return (
      <div className="h-screen w-screen bg-[#121312] text-gray-300 flex items-center justify-center font-sans relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#A3F58F]/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-[#A3F58F]/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="bg-[#1A1C1B]/80 backdrop-blur-xl border border-white/10 p-10 rounded-[32px] w-full max-w-md shadow-2xl z-10">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-[#A3F58F] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(163,245,143,0.4)]">
              <div className="w-5 h-5 bg-[#121312] rounded-sm rotate-45"></div>
            </div>
            <h2 className="text-white font-black text-3xl tracking-tighter">NEO-Z</h2>
          </div>

          <h3 className="text-center text-xl font-bold text-white mb-2">
            {authMode === "login" ? "Welcome Back" : "Create an Account"}
          </h3>
          <p className="text-center text-gray-500 text-sm mb-8">
            {authMode === "login" ? "Enter your details to access your workspaces." : "Join NEO-Z to start building your intelligence engine."}
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" required placeholder="Full Name" 
                  value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                  className="w-full bg-[#0d0e0d] border border-white/10 text-white pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-[#A3F58F]/50 transition-colors"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="email" required placeholder="Email Address" 
                value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                className="w-full bg-[#0d0e0d] border border-white/10 text-white pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-[#A3F58F]/50 transition-colors"
              />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="password" required placeholder="Password" 
                value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                className="w-full bg-[#0d0e0d] border border-white/10 text-white pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-[#A3F58F]/50 transition-colors"
              />
            </div>

            <button type="submit" disabled={isAuthLoading} className="w-full bg-[#A3F58F] text-[#121312] font-black text-sm py-4 rounded-xl mt-2 hover:bg-[#8ee07a] hover:scale-[1.02] transition-all disabled:opacity-50">
              {isAuthLoading ? "PROCESSING..." : (authMode === "login" ? "LOGIN TO NEO-Z" : "SIGN UP NOW")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {authMode === "login" ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }} className="text-[#A3F58F] font-bold ml-2 hover:underline">
              {authMode === "login" ? "Sign up" : "Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🟢 RENDER: MAIN DASHBOARD
  // ==========================================
  return (
    <div className="h-screen w-screen bg-[#121312] text-gray-300 flex font-sans overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      {!isSharedView && (
        <div className={`bg-[#0d0e0d] border-white/5 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden z-20 ${isSidebarOpen ? 'w-[300px] border-r opacity-100' : 'w-0 border-r-0 opacity-0'}`}>
          <div className="w-[300px] flex flex-col h-full p-4">
            
            <div className="flex items-center justify-between mb-8 px-2 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-[#A3F58F] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(163,245,143,0.3)]">
                  <div className="w-3.5 h-3.5 bg-[#121312] rounded-sm rotate-45"></div>
                </div>
                <h2 className="text-white font-bold text-xl tracking-tighter">NEO-Z</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                <Menu size={20} />
              </button>
            </div>

            <button onClick={() => createNewChat(null)} className="w-full bg-[#A3F58F] text-[#121312] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mb-6 hover:bg-[#8ee07a] transition-all hover:scale-[0.98]">
              <Plus size={20} strokeWidth={3} /> New Chat
            </button>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-6">
              
              {/* WORKSPACES */}
              <div>
                <div className="flex items-center justify-between px-2 mb-2">
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[2px]">Workspaces</p>
                  <button onClick={() => setIsProjectModalOpen(true)} className="text-gray-500 hover:text-[#A3F58F] transition-colors bg-white/5 p-1 rounded-md"><Plus size={14}/></button>
                </div>
                <div className="space-y-1">
                  {projects.map(proj => (
                    <div key={proj._id} className="flex flex-col">
                      <div onClick={() => setActiveProjectId(activeProjectId === proj._id ? null : proj._id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeProjectId === proj._id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-300"}`}>
                        {activeProjectId === proj._id ? <FolderOpen size={16} className="text-[#A3F58F]" /> : <Folder size={16} />}
                        <span className="font-semibold text-sm truncate flex-1">{proj.name}</span>
                        <ChevronRight size={14} className={`transition-transform ${activeProjectId === proj._id ? "rotate-90" : ""}`} />
                      </div>
                      
                      {activeProjectId === proj._id && (
                        <div className="ml-5 border-l-2 border-white/5 pl-3 mt-1 space-y-1 py-1">
                          {projectChats.filter(c => c.projectId === proj._id).map(chat => (
                            <div key={chat._id} onClick={() => setActiveChatId(chat._id)} className={`group flex items-center justify-between text-xs px-3 py-2 rounded-lg cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-[#A3F58F]/10 border border-[#A3F58F]/20" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                              <span className="truncate">{chat.title}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={(e) => { e.stopPropagation(); copyShareLink(chat._id); }} className="hover:text-blue-400 p-1"><Share2 size={12} /></button>
                                 <button onClick={(e) => deleteChat(e, chat._id)} className="hover:text-red-400 p-1"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => createNewChat(proj._id)} className="text-[10px] font-bold text-[#A3F58F] px-3 py-2 hover:bg-white/5 rounded-lg w-full text-left transition-colors">+ New Workspace Chat</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RECENT CHATS */}
              <div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[2px] mb-2 px-2">Recent Chats</p>
                <div className="space-y-1">
                  {standaloneChats.map(chat => (
                    <div key={chat._id} onClick={() => setActiveChatId(chat._id)} className={`group flex items-center justify-between text-sm px-3 py-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-white/10 border border-white/5 shadow-lg" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText size={14} className={activeChatId === chat._id ? "text-white" : "text-gray-600"} />
                        <span className="truncate font-medium">{chat.title}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button onClick={(e) => { e.stopPropagation(); copyShareLink(chat._id); }} className="p-1.5 hover:bg-blue-500/10 rounded-md text-gray-500 hover:text-blue-400 transition-all"><Share2 size={12} /></button>
                        <button onClick={(e) => deleteChat(e, chat._id)} className="p-1.5 hover:bg-red-500/10 rounded-md text-gray-500 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ✅ UPDATED: USER PROFILE & LOGOUT */}
            <div className="mt-4 flex items-center gap-3 px-2 pt-4 border-t border-white/5 text-gray-500">
              <div className="w-8 h-8 rounded-full bg-[#A3F58F] text-[#121312] flex items-center justify-center text-xs font-black uppercase shrink-0 shadow-[0_0_10px_rgba(163,245,143,0.3)]">
                {user?.name?.charAt(0) || "Z"}
              </div>
              <div className="flex flex-col flex-1 truncate">
                <span className="text-white text-xs font-bold truncate">{user?.name || "User Zaid"}</span>
                <span className="text-[10px] truncate opacity-60">{user?.email || "Free Tier"}</span>
              </div>
              <button onClick={handleLogout} className="hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title="Log Out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN AREA */}
      <div className="flex-1 flex flex-col relative bg-[#121312] min-w-0 transition-all duration-300">
        
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-3 text-white">
            {!isSidebarOpen && !isSharedView && (
              <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 hover:text-white transition-colors mr-2 cursor-pointer z-50">
                <Menu size={20} />
              </button>
            )}
            {isSharedView && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1">Shared View</span>}
            <span className="text-sm font-medium opacity-60 truncate">/ {activeChat?.title || "Shared Conversation"}</span>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
             {!isSharedView && (
               <button onClick={() => copyShareLink(activeChat?._id)} className="flex items-center gap-2 text-xs font-bold bg-[#A3F58F]/10 hover:bg-[#A3F58F]/20 text-[#A3F58F] px-4 py-2 rounded-lg border border-[#A3F58F]/20 transition-all cursor-pointer">
                 <Share size={14} /> SHARE LINK
               </button>
             )}
             <button className="w-9 h-9 flex items-center justify-center text-gray-400 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5">⭐</button>
          </div>
        </div>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          {(!activeChat || activeChat.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center p-6">
               <div className="mb-10 animate-pulse">
                  <div className="w-40 h-40 bg-[#A3F58F]/5 rounded-full flex items-center justify-center border border-[#A3F58F]/10 shadow-[0_0_50px_rgba(163,245,143,0.05)]">
                    <Bot size={80} className="text-[#A3F58F] opacity-80" />
                  </div>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight text-center">What's the plan, {user?.name?.split(" ")[0] || "Zaid"}?</h1>
               <p className="text-gray-500 text-lg mb-12 text-center">I'm NEO-Z, your upgraded intelligence partner.</p>
            </div>
          ) : (
            <div className="p-6 lg:p-10 space-y-8 max-w-4xl mx-auto w-full">
               {activeChat.messages.map((c, i) => (
                 <div key={i} className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} w-full`}>
                   <div className="flex items-start gap-4 w-full">
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${c.role === 'user' ? 'bg-indigo-600 order-last uppercase' : 'bg-[#A3F58F] text-[#121312]'}`}>
                        {c.role === 'user' ? (user?.name?.charAt(0) || 'U') : 'NZ'}
                      </div>
                      <div className={`flex-1 text-sm leading-relaxed ${c.role === 'user' ? 'text-right pr-4' : 'text-left pl-4'}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                           p: ({node, ...props}) => <p className="mb-4 last:mb-0 whitespace-pre-line" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                           code: ({node, inline, children, ...props}) => !inline ? (
                            <div className="w-full bg-[#0a0b0a] border border-white/5 rounded-xl overflow-hidden my-4 text-left shadow-lg">
                              <pre className="p-5 overflow-x-auto text-gray-300 font-mono text-sm">{children}</pre>
                            </div>
                           ) : <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#A3F58F] font-mono" {...props}>{children}</code>
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
        <div className="p-6 pt-0 max-w-4xl mx-auto w-full shrink-0">
          {isSharedView ? (
            <div className="bg-[#1A1C1B] rounded-[22px] border border-white/5 p-6 shadow-2xl flex flex-col items-center justify-center text-center">
               <p className="text-gray-400 mb-4 text-sm">You are viewing a shared, read-only conversation.</p>
               <button onClick={() => window.location.href = "/"} className="bg-[#A3F58F] text-[#121312] font-bold px-6 py-3 rounded-xl hover:bg-[#8ee07a] transition-all flex items-center gap-2 cursor-pointer">
                  <Bot size={18} /> Start Your Own Chat
               </button>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="bg-[#1A1C1B] rounded-[22px] border border-white/5 p-2 shadow-2xl flex flex-col focus-within:border-[#A3F58F]/30 transition-all">
              
              {imagePreview && (
                <div className="relative ml-4 mt-2 inline-block w-fit">
                  <img src={imagePreview} alt="Upload Preview" className="h-16 w-16 object-cover rounded-xl border border-white/10 shadow-lg" />
                  <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1 border border-white/20 hover:bg-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              )}

              <input
                className="w-full bg-transparent text-gray-200 px-5 py-4 outline-none placeholder:text-gray-600 text-base"
                placeholder={activeChat?.projectId ? "Command NEO-Z in this workspace context..." : "Command NEO-Z..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

              <div className="flex items-center justify-between px-3 pb-2 mt-1">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-4">
                  <button type="button" className="text-[10px] font-black text-gray-400 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:text-white transition-all uppercase tracking-wider whitespace-nowrap"><Lightbulb size={12}/> Brainstorm</button>
                  <button type="button" className="text-[10px] font-black text-gray-400 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:text-white transition-all uppercase tracking-wider whitespace-nowrap"><Code size={12}/> Code</button>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                    <Paperclip size={18} />
                  </button>
                  
                  <button type="submit" disabled={!message.trim() && !imageBase64} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${(message.trim() || imageBase64) ? "bg-[#A3F58F] text-[#121312] hover:scale-105" : "bg-white/5 text-gray-600"}`}>
                    <Send size={18} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </form>
          )}
          <p className="text-[10px] text-center text-gray-600 mt-4 font-bold tracking-widest uppercase">Powered by Gemini Engine</p>
        </div>
      </div>

      {/* 3. RIGHT MINI SIDEBAR */}
      {!isSharedView && (
        <div className="w-[70px] bg-[#0d0e0d] border-l border-white/5 flex flex-col items-center py-8 gap-6 text-gray-500 shrink-0 z-10 hidden sm:flex">
          <button className="hover:text-[#A3F58F] transition-colors"><Bookmark size={20} /></button>
          <button className="hover:text-[#A3F58F] transition-colors"><Wrench size={20} /></button>
          <button className="hover:text-[#A3F58F] transition-colors"><DollarSign size={20} /></button>
          <div className="mt-auto flex flex-col gap-6">
            <button className="hover:text-white"><Settings size={20} /></button>
            <button className="hover:text-white"><HelpCircle size={20} /></button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {isProjectModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C1B] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">New Workspace</h3>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" 
                placeholder="e.g. Website Project" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                className="w-full bg-[#0d0e0d] border border-white/10 text-white px-4 py-3 rounded-xl mb-6 outline-none focus:border-[#A3F58F]/50 transition-colors"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={!newProjectName.trim()} className="px-4 py-2 bg-[#A3F58F] text-[#121312] font-bold text-sm rounded-lg hover:bg-[#8ee07a] transition-all disabled:opacity-50">Create Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;