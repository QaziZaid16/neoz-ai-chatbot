import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Menu, Settings, Bell, FileText, Share, Star, 
  Bot, Code, Lightbulb, Paperclip, Mic, Send, Bookmark, Wrench, DollarSign, 
  HelpCircle, Plus, Trash2, Share2, X, Folder, FolderOpen, ChevronRight, LogOut, Mail, Lock, User
} from "lucide-react";

const API_BASE_URL = "https://neoz-ai-chatbot.onrender.com";

const initialToken = localStorage.getItem("token");
if (initialToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}

function App() {
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [authMode, setAuthMode] = useState("login"); 
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // ✅ Responsive Sidebar State (Open by default on Desktop, Closed on Mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  
  const urlParams = new URLSearchParams(window.location.search);
  const sharedChatId = urlParams.get('share');
  const [isSharedView, setIsSharedView] = useState(!!sharedChatId);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeChat = chats.find(c => c._id === activeChatId) || chats.find(c => c._id === "temp") || null;

  // ✅ Auto-close sidebar on mobile when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
         setAuthForm({ ...authForm, password: "" }); 
      } else {
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

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setChats([]);
    setProjects([]);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  useEffect(() => {
    const fetchData = async () => {
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
          if(err.response?.status === 401) handleLogout(); 
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

  // ✅ MOBILE UX: Helper to select chat and auto-close sidebar on mobile
  const selectChatMobileFriendly = (id) => {
    setActiveChatId(id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const createNewChat = (projectId = null) => {
    const filteredChats = chats.filter(c => c._id !== "temp"); 
    const newChat = { _id: "temp", title: "New Chat", projectId: projectId, messages: [] };
    setChats([newChat, ...filteredChats]);
    selectChatMobileFriendly("temp");
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
    } catch(err) {}
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
      if(err.response?.status === 401) handleLogout(); 
      setChats(prevChats => prevChats.map(chat => {
        if (chat._id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: "⚠️ **Error:** Server connection failed." }] };
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
  // 🟢 RENDER: AUTHENTICATION SCREEN (RESPONSIVE)
  // ==========================================
  if (!token && !isSharedView) {
    return (
      <div className="min-h-screen w-screen bg-[#090A0F] text-[#EDEDED] flex items-center justify-center relative overflow-hidden px-4 py-8">
        <div className="absolute top-[-30%] left-[-20%] w-[80vw] md:w-[60vw] h-[80vw] md:h-[60vw] bg-[#D4AF37]/5 blur-[100px] md:blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-30%] right-[-20%] w-[80vw] md:w-[60vw] h-[80vw] md:h-[60vw] bg-white/5 blur-[80px] md:blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="bg-[#13151A]/60 backdrop-blur-3xl border border-white/5 p-8 md:p-12 rounded-[32px] md:rounded-[40px] w-full max-w-md shadow-2xl z-10">
          <div className="flex flex-col items-center gap-4 mb-8 md:mb-10">
            <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#A88728] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <div className="w-5 h-5 bg-[#090A0F] rounded-md rotate-45"></div>
            </div>
            <h2 className="text-white font-display font-bold text-3xl md:text-4xl tracking-tight">NEO-Z</h2>
          </div>

          <h3 className="text-center text-lg md:text-xl font-medium text-white mb-2">
            {authMode === "login" ? "Welcome Back" : "Request Access"}
          </h3>
          <p className="text-center text-[#8B949E] text-xs md:text-sm mb-8">
            {authMode === "login" ? "Enter your credentials to continue." : "Join the intelligence network."}
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs md:text-sm mb-6 text-center font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
                <input 
                  type="text" required placeholder="Full Name" 
                  value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                  className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
              <input 
                type="email" required placeholder="Email Address" 
                value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"
              />
            </div>
            <div className="relative">
              <Lock size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
              <input 
                type="password" required placeholder="Password" 
                value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"
              />
            </div>

            <button type="submit" disabled={isAuthLoading} className="w-full bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-[#090A0F] font-bold text-xs md:text-sm py-3.5 md:py-4 rounded-2xl mt-4 hover:opacity-90 hover:scale-[1.01] transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(212,175,55,0.2)]">
              {isAuthLoading ? "PROCESSING..." : (authMode === "login" ? "ENTER WORKSPACE" : "CREATE ACCOUNT")}
            </button>
          </form>

          <div className="mt-8 text-center text-xs md:text-sm text-[#8B949E]">
            {authMode === "login" ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }} className="text-[#D4AF37] font-medium ml-2 hover:underline">
              {authMode === "login" ? "Request Access" : "Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🟢 RENDER: MAIN DASHBOARD (RESPONSIVE)
  // ==========================================
  return (
    <div className="h-screen w-screen bg-[#090A0F] text-[#EDEDED] flex overflow-hidden relative">
      
      {/* ✅ MOBILE OVERLAY (Darkens background when sidebar opens on phone) */}
      {!isSharedView && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* 1. LEFT SIDEBAR (RESPONSIVE) */}
      {!isSharedView && (
        <div className={`fixed md:relative z-40 h-full transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'translate-x-0 w-[85vw] sm:w-[320px] opacity-100' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0'} p-2 md:pl-4 md:py-4`}>
          <div className="bg-[#13151A]/90 backdrop-blur-xl border border-white/5 flex flex-col h-full rounded-[24px] md:rounded-[32px] p-4 md:p-5 shadow-2xl">
            
            <div className="flex items-center justify-between mb-6 md:mb-8 px-1 md:px-2 mt-1 md:mt-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-[#D4AF37] to-[#A88728] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#090A0F] rounded-sm rotate-45"></div>
                </div>
                <h2 className="text-white font-display font-bold text-lg md:text-xl tracking-tight">NEO-Z</h2>
              </div>
              {/* Close Button on Mobile / Retract on Desktop */}
              <button onClick={() => setIsSidebarOpen(false)} className="text-[#8B949E] hover:text-white transition-colors cursor-pointer p-1">
                <X size={20} strokeWidth={1.5} className="md:hidden" />
                <Menu size={20} strokeWidth={1.5} className="hidden md:block" />
              </button>
            </div>

            <button onClick={() => createNewChat(null)} className="w-full bg-white/5 border border-white/10 text-white font-medium py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 mb-4 md:mb-6 hover:bg-white/10 transition-all text-sm md:text-base">
              <Plus size={16} strokeWidth={2} className="text-[#D4AF37]" /> New Conversation
            </button>

            <div className="flex-1 overflow-y-auto pr-1 md:pr-2 scrollbar-hide space-y-4 md:space-y-6">
              
              {/* WORKSPACES */}
              <div>
                <div className="flex items-center justify-between px-2 mb-2 md:mb-3">
                  <p className="text-[9px] md:text-[10px] text-[#8B949E] font-bold uppercase tracking-widest">Workspaces</p>
                  <button onClick={() => setIsProjectModalOpen(true)} className="text-[#8B949E] hover:text-[#D4AF37] transition-colors p-1"><Plus size={14}/></button>
                </div>
                <div className="space-y-1">
                  {projects.map(proj => (
                    <div key={proj._id} className="flex flex-col">
                      <div onClick={() => setActiveProjectId(activeProjectId === proj._id ? null : proj._id)} className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl cursor-pointer transition-all ${activeProjectId === proj._id ? "bg-white/10 text-white shadow-inner" : "text-[#8B949E] hover:bg-white/5 hover:text-white"}`}>
                        {activeProjectId === proj._id ? <FolderOpen size={14} strokeWidth={1.5} className="text-[#D4AF37]" /> : <Folder size={14} strokeWidth={1.5} />}
                        <span className="font-medium text-xs md:text-sm truncate flex-1">{proj.name}</span>
                        <ChevronRight size={12} className={`transition-transform opacity-50 ${activeProjectId === proj._id ? "rotate-90" : ""}`} />
                      </div>
                      
                      {activeProjectId === proj._id && (
                        <div className="ml-4 md:ml-5 border-l border-white/10 pl-2 md:pl-3 mt-1 space-y-1 py-1">
                          {projectChats.filter(c => c.projectId === proj._id).map(chat => (
                            <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} className={`group flex items-center justify-between text-[11px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-md md:rounded-lg cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-[#D4AF37]/10" : "text-[#8B949E] hover:text-white hover:bg-white/5"}`}>
                              <span className="truncate font-medium">{chat.title}</span>
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                 <button onClick={(e) => { e.stopPropagation(); copyShareLink(chat._id); }} className="hover:text-blue-400 p-1"><Share2 size={12} /></button>
                                 <button onClick={(e) => deleteChat(e, chat._id)} className="hover:text-red-400 p-1"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => createNewChat(proj._id)} className="text-[9px] md:text-[10px] font-medium text-[#D4AF37] px-2 md:px-3 py-2 hover:bg-white/5 rounded-lg w-full text-left transition-colors">+ Add Document</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RECENT CHATS */}
              <div>
                <p className="text-[9px] md:text-[10px] text-[#8B949E] font-bold uppercase tracking-widest mb-2 md:mb-3 px-2">Recent Threads</p>
                <div className="space-y-1">
                  {standaloneChats.map(chat => (
                    <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} className={`group flex items-center justify-between text-xs md:text-sm px-3 py-2.5 md:py-3 rounded-lg md:rounded-xl cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-white/10 shadow-inner" : "text-[#8B949E] hover:text-white hover:bg-white/5"}`}>
                      <div className="flex items-center gap-2 md:gap-3 truncate">
                        <FileText size={14} strokeWidth={1.5} className={activeChatId === chat._id ? "text-[#D4AF37]" : "text-[#8B949E]"} />
                        <span className="truncate font-medium">{chat.title}</span>
                      </div>
                      <div className={`flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                        <button onClick={(e) => { e.stopPropagation(); copyShareLink(chat._id); }} className="p-1 hover:text-blue-400 transition-all"><Share2 size={14} /></button>
                        <button onClick={(e) => deleteChat(e, chat._id)} className="p-1 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* USER PROFILE */}
            <div className="mt-2 md:mt-4 flex items-center gap-2 md:gap-3 px-2 md:px-3 pt-3 md:pt-4 border-t border-white/5 text-[#8B949E]">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#A88728] text-[#090A0F] flex items-center justify-center text-[10px] md:text-xs font-bold uppercase shrink-0 shadow-lg">
                {user?.name?.charAt(0) || "Z"}
              </div>
              <div className="flex flex-col flex-1 truncate">
                <span className="text-white text-[11px] md:text-xs font-medium truncate">{user?.name || "User Zaid"}</span>
                <span className="text-[9px] md:text-[10px] truncate opacity-60 font-light">{user?.email || "Pro Tier"}</span>
              </div>
              <button onClick={handleLogout} className="hover:text-red-400 p-1.5 md:p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" title="Log Out">
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN CHAT AREA (RESPONSIVE) */}
      <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
        
        {/* Header */}
        <div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 lg:px-12 shrink-0 z-10 border-b border-white/5 md:border-none">
          <div className="flex items-center gap-2 md:gap-3 text-white max-w-[70%]">
            {!isSharedView && (
              <button onClick={() => setIsSidebarOpen(true)} className={`text-[#8B949E] hover:text-white transition-colors mr-1 cursor-pointer z-20 ${isSidebarOpen ? 'hidden' : 'block'}`}>
                <Menu size={20} strokeWidth={1.5} />
              </button>
            )}
            {isSharedView && <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shrink-0"><Star size={8}/> Shared View</span>}
            <span className="text-xs md:text-sm font-medium text-[#8B949E] truncate font-display">/ {activeChat?.title || "Shared Conversation"}</span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
             {!isSharedView && (
               <button onClick={() => copyShareLink(activeChat?._id)} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-medium text-[#D4AF37] hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-[#D4AF37]/30 hover:border-[#D4AF37] bg-[#D4AF37]/5 transition-all cursor-pointer">
                 <Share size={12} strokeWidth={1.5} /> <span className="hidden sm:inline">Share</span>
               </button>
             )}
          </div>
        </div>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative px-4 md:px-8">
          {(!activeChat || activeChat.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center p-4 md:p-6 mt-[-10vh]">
               <div className="mb-6 md:mb-8">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-[24px] md:rounded-[32px] flex items-center justify-center border border-white/10 shadow-[0_0_80px_rgba(212,175,55,0.05)] backdrop-blur-md">
                    <Bot size={40} strokeWidth={1} className="text-[#D4AF37] opacity-80" />
                  </div>
               </div>
               <h1 className="text-3xl md:text-5xl font-display font-medium text-white mb-3 md:mb-4 tracking-tight text-center">
                 Good evening, <br className="md:hidden" />{user?.name?.split(" ")[0] || "Zaid"}.
               </h1>
               <p className="text-[#8B949E] text-sm md:text-lg text-center font-light">How can NEO-Z assist you today?</p>
            </div>
          ) : (
            <div className="py-6 md:py-10 space-y-6 md:space-y-10 max-w-3xl mx-auto w-full">
               {activeChat.messages.map((c, i) => (
                 <div key={i} className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} w-full`}>
                   <div className="flex items-start gap-2 md:gap-4 max-w-[95%] md:max-w-[85%]">
                      {c.role !== 'user' && (
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0 flex items-center justify-center border border-white/10 bg-[#13151A] text-[#D4AF37] shadow-lg mt-1">
                          <Bot size={14} strokeWidth={1.5} />
                        </div>
                      )}
                      
                      <div className={`text-[14px] md:text-[15px] leading-relaxed ${c.role === 'user' ? 'bg-white/5 border border-white/10 px-4 py-3 md:px-5 md:py-3.5 rounded-2xl md:rounded-3xl rounded-tr-sm text-[#EDEDED]' : 'text-[#D4AF37]/90 font-light'}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                           p: ({node, ...props}) => <p className="mb-3 md:mb-4 last:mb-0 whitespace-pre-wrap break-words" {...props} />,
                           strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                           code: ({node, inline, children, ...props}) => !inline ? (
                            <div className="w-[85vw] sm:w-full bg-[#13151A] border border-white/10 rounded-xl md:rounded-2xl overflow-hidden my-3 md:my-4 shadow-xl">
                              <pre className="p-3 md:p-5 overflow-x-auto text-[#EDEDED] font-mono text-[12px] md:text-sm">{children}</pre>
                            </div>
                           ) : <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[#D4AF37] font-mono text-[11px] md:text-[13px] break-all" {...props}>{children}</code>
                        }}>
                          {c.text}
                        </ReactMarkdown>
                      </div>

                      {c.role === 'user' && (
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-white/10 text-white font-medium text-[10px] md:text-xs mt-1">
                          {user?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                   </div>
                 </div>
               ))}
               {isTyping && (
                 <div className="flex items-center gap-3 md:gap-4 max-w-[85%]">
                   <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0 flex items-center justify-center border border-white/10 bg-[#13151A] text-[#D4AF37] shadow-lg">
                      <Bot size={14} strokeWidth={1.5} />
                   </div>
                   <div className="text-[#D4AF37] text-[10px] md:text-xs font-medium tracking-widest uppercase animate-pulse">Analyzing...</div>
                 </div>
               )}
               {/* Pad bottom area so messages aren't hidden behind the floating input */}
               <div ref={chatEndRef} className="h-24 md:h-28" /> 
            </div>
          )}
        </div>

        {/* Input Area (RESPONSIVE PILL) */}
        <div className="absolute bottom-4 md:bottom-6 left-0 right-0 px-2 md:px-4 pointer-events-none z-10">
          <div className="max-w-3xl mx-auto w-full pointer-events-auto">
            {isSharedView ? (
              <div className="bg-[#13151A]/90 backdrop-blur-2xl rounded-full border border-white/10 p-3 md:p-4 shadow-2xl flex items-center justify-between px-4 md:px-8">
                 <p className="text-[#8B949E] text-xs md:text-sm">Shared, read-only document.</p>
                 <button onClick={() => window.location.href = "/"} className="bg-white text-[#090A0F] font-bold px-4 py-1.5 md:px-6 md:py-2 rounded-full hover:bg-gray-200 transition-all text-xs md:text-sm">
                    Start Chat
                 </button>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="bg-[#13151A]/85 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] border border-white/10 p-1.5 md:p-2 pl-3 md:pl-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center focus-within:border-[#D4AF37]/50 transition-all">
                
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[#8B949E] hover:text-white transition-colors cursor-pointer p-1.5 md:p-2 bg-white/5 rounded-full shrink-0">
                  <Paperclip size={16} strokeWidth={1.5} className="md:w-[18px] md:h-[18px]" />
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

                {imagePreview && (
                  <div className="relative ml-2 md:ml-3 shrink-0">
                    <img src={imagePreview} alt="Preview" className="h-8 w-8 md:h-10 md:w-10 object-cover rounded-md md:rounded-lg border border-white/20" />
                    <button type="button" onClick={clearImage} className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 bg-red-500 text-white rounded-full p-0.5">
                      <X size={10} />
                    </button>
                  </div>
                )}

                <input
                  className="flex-1 bg-transparent text-[#EDEDED] px-3 md:px-4 py-2.5 md:py-3 outline-none placeholder:text-[#8B949E] text-sm md:text-[15px] font-light min-w-0"
                  placeholder={activeChat?.projectId ? "Command Workspace..." : "Message NEO-Z..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                
                <button type="submit" disabled={!message.trim() && !imageBase64} className={`w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ml-1 md:ml-2 ${(message.trim() || imageBase64) ? "bg-[#D4AF37] text-[#090A0F] shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:scale-105" : "bg-white/5 text-[#8B949E]"}`}>
                  <Send size={16} strokeWidth={2} className="ml-0.5 md:ml-1 md:w-[18px] md:h-[18px]" />
                </button>
              </form>
            )}
            <p className="text-[8px] md:text-[10px] text-center text-[#8B949E] mt-2 md:mt-3 font-medium tracking-widest uppercase opacity-50">Powered by Gemini Engine</p>
          </div>
        </div>
      </div>

      {/* MODAL (RESPONSIVE) */}
      {isProjectModalOpen && (
        <div className="absolute inset-0 bg-[#090A0F]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-white/10 p-6 md:p-8 rounded-[24px] md:rounded-[32px] w-full max-w-sm shadow-2xl">
            <h3 className="text-lg md:text-xl font-display font-medium text-white mb-4 md:mb-6">New Workspace</h3>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" 
                placeholder="e.g. NextJS Project" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                className="w-full bg-[#090A0F] border border-white/10 text-white px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl mb-6 md:mb-8 outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"
              />
              <div className="flex justify-end gap-2 md:gap-3">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 md:px-5 py-2 md:py-3 text-xs md:text-sm text-[#8B949E] hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={!newProjectName.trim()} className="px-5 md:px-6 py-2 md:py-3 bg-[#D4AF37] text-[#090A0F] font-bold text-xs md:text-sm rounded-lg md:rounded-xl hover:opacity-90 transition-all disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;