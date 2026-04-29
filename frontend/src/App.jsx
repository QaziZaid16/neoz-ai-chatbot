import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Papa from "papaparse";
import { 
  Menu, Settings, Bell, FileText, Share, Star, 
  Bot, Code, Lightbulb, Paperclip, Mic, Send, Bookmark, Wrench, DollarSign, 
  HelpCircle, Plus, Trash2, Share2, X, Folder, FolderOpen, ChevronRight, LogOut, Mail, Lock, User,
  Copy, Check, MessageCircle, FileSpreadsheet, Usb, 
  Palette, Code2, PenTool, LineChart // ✅ AGENTS KE NAYE ICONS
} from "lucide-react";

const API_BASE_URL = "https://neoz-ai-chatbot.onrender.com";

const initialToken = localStorage.getItem("token");
if (initialToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}

// ✅ THE EXPERT SQUAD (Agents List)
const EXPERT_AGENTS = [
  { id: "developer", name: "Developer", icon: Code2, desc: "Code, logic & debugging", color: "text-blue-400", bg: "bg-blue-400/10" },
  { id: "designer", name: "Designer", icon: Palette, desc: "UI/UX & aesthetics", color: "text-pink-400", bg: "bg-pink-400/10" },
  { id: "writer", name: "Writer", icon: PenTool, desc: "Copywriting & emails", color: "text-green-400", bg: "bg-green-400/10" },
  { id: "analyst", name: "Analyst", icon: LineChart, desc: "Data & CSV insights", color: "text-purple-400", bg: "bg-purple-400/10" },
];

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
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [tooltip, setTooltip] = useState({ show: false, text: "", top: 0, left: 0 });
  
  const urlParams = new URLSearchParams(window.location.search);
  const sharedChatId = urlParams.get('share');
  const [isSharedView, setIsSharedView] = useState(!!sharedChatId);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // FILES & HARDWARE STATE
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [csvFile, setCsvFile] = useState(null); 
  const [hardwarePort, setHardwarePort] = useState(null); 
  
  // ✅ AGENT MENU STATES
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const inputRef = useRef(null); // ✅ Focus wapas input pe laane ke liye

  const activeChat = chats.find(c => c._id === activeChatId) || chats.find(c => c._id === "temp") || null;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseEnter = (e, text) => {
    if (isSidebarOpen || window.innerWidth < 768) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      text: text,
      top: rect.top + (rect.height / 2),
      left: rect.right + 12
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, text: "", top: 0, left: 0 });
  };

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
    disconnectHardware(); 
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

  // ✅ SMART INPUT HANDLER (Detects @ for Agent Menu)
  const handleMessageChange = (e) => {
    const val = e.target.value;
    setMessage(val);

    const words = val.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setShowAgentMenu(true);
      setAgentSearch(lastWord.substring(1).toLowerCase());
    } else {
      setShowAgentMenu(false);
    }
  };

  // ✅ INJECT AGENT INTO INPUT
  const handleSelectAgent = (agentName) => {
    const words = message.split(" ");
    words.pop(); // Remove the incomplete @ search
    const newMessage = words.join(" ") + (words.length > 0 ? " " : "") + `@${agentName} `;
    
    setMessage(newMessage);
    setShowAgentMenu(false);
    inputRef.current?.focus();
  };

  const openShareModal = (id) => {
    if(id === "temp") return alert("Please start the conversation before sharing.");
    const link = `${window.location.origin}/?share=${id}`;
    setShareLink(link);
    setIsShareModalOpen(true);
    setIsCopied(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); 
  };

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
    clearAttachments();
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

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        setCsvFile({ name: file.name, data: JSON.stringify(results.data, null, 2) });
      },
      error: function(err) { alert("Failed to parse CSV file: " + err.message); }
    });
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const clearAttachments = () => {
    setImagePreview(null);
    setImageBase64(null);
    setMimeType(null);
    setCsvFile(null); 
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const connectHardware = async () => {
    if (!("serial" in navigator)) {
      alert("Oops! Web Serial API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setHardwarePort(port);
      setChats(prevChats => prevChats.map(chat => {
        if (chat._id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, { role: "bot", text: "⚡ **Hardware Link Established.** NEO-Z is now listening to the serial port." }]
          };
        }
        return chat;
      }));
    } catch (err) { console.error("Connection Failed:", err); }
  };

  const disconnectHardware = async () => {
    if (hardwarePort) {
      try { await hardwarePort.close(); setHardwarePort(null); } catch (err) {}
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() && !imageBase64 && !csvFile) return;

    const baseMsg = message.trim();
    let payloadMsg = baseMsg;
    
    if (csvFile) {
      payloadMsg = `[Data File Attached: ${csvFile.name}]\n\n\`\`\`json\n${csvFile.data}\n\`\`\`\n\nTask: ${baseMsg || "Analyze this data."}`;
    }

    // ✅ MAGIC INVISIBLE PROMPT INJECTION (For Agents)
    const agentMatch = baseMsg.match(/@(Developer|Designer|Writer|Analyst)/i);
    if (agentMatch) {
        const agent = agentMatch[1];
        payloadMsg = `[System Command: You are now acting strictly as a Senior Expert ${agent}. Tailor your entire response, tone, and formatting to reflect the mindset of a professional ${agent}.]\n\nUser Query: ` + payloadMsg;
    }

    const currentBase64 = imageBase64;
    const currentMimeType = mimeType;
    const currentProjectId = activeChat?.projectId || null;
    
    setMessage("");
    setShowAgentMenu(false); // Close menu if open
    clearAttachments(); 

    setChats(prevChats => prevChats.map(chat => {
      if (chat._id === activeChatId) {
        const visualMsg = currentBase64 ? `[Image Attached] 🖼️\n${baseMsg}` : baseMsg; // Sirf clean message UI pe dikhega
        return {
          ...chat,
          title: chat.messages.length === 0 ? (baseMsg.substring(0, 25) || "Data Analysis") : chat.title,
          messages: [...chat.messages, { role: "user", text: visualMsg }]
        };
      }
      return chat;
    }));

    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/chat`, { 
        message: payloadMsg, 
        chatId: activeChatId === "temp" ? null : activeChatId,
        projectId: currentProjectId,
        imageBase64: currentBase64,
        mimeType: currentMimeType,
        hardwareConnected: !!hardwarePort 
      });

      const updatedDBChat = res.data;
      setChats(prevChats => {
        const filtered = prevChats.filter(c => c._id !== "temp" && c._id !== activeChatId);
        return [updatedDBChat, ...filtered];
      });
      setActiveChatId(updatedDBChat._id); 

      if (hardwarePort && updatedDBChat.messages) {
        const lastBotMsg = updatedDBChat.messages[updatedDBChat.messages.length - 1].text;
        const cmdMatch = lastBotMsg.match(/<CMD>(.*?)<\/CMD>/);
        if (cmdMatch && cmdMatch[1]) {
           const writer = hardwarePort.writable.getWriter();
           const encoder = new TextEncoder();
           await writer.write(encoder.encode(cmdMatch[1] + "\n"));
           writer.releaseLock();
        }
      }

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
          <h3 className="text-center text-lg md:text-xl font-medium text-white mb-2">{authMode === "login" ? "Welcome Back" : "Request Access"}</h3>
          <p className="text-center text-[#8B949E] text-xs md:text-sm mb-8">{authMode === "login" ? "Enter your credentials to continue." : "Join the intelligence network."}</p>
          {authError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs md:text-sm mb-6 text-center font-medium">{authError}</div>}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
                <input type="text" required placeholder="Full Name" value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"/>
              </div>
            )}
            <div className="relative">
              <Mail size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
              <input type="email" required placeholder="Email Address" value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"/>
            </div>
            <div className="relative">
              <Lock size={18} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B949E]" />
              <input type="password" required placeholder="Password" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-[#090A0F]/50 border border-white/10 text-white pl-12 pr-4 py-3.5 md:py-4 rounded-2xl outline-none focus:border-[#D4AF37]/50 transition-colors placeholder:text-[#8B949E] text-sm md:text-base"/>
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

  return (
    <div className="h-screen w-screen bg-[#090A0F] text-[#EDEDED] flex overflow-hidden relative">
      
      {tooltip.show && (
        <div 
          className="fixed z-[100] px-3 py-2 bg-[#13151A] border border-white/10 text-white text-xs font-medium rounded-lg shadow-2xl pointer-events-none whitespace-nowrap"
          style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
        >
          {tooltip.text}
          <div className="absolute top-1/2 -left-1 w-2 h-2 bg-[#13151A] border-l border-b border-white/10 rotate-45 -translate-y-1/2"></div>
        </div>
      )}

      {!isSharedView && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {!isSharedView && (
        <div className={`fixed md:relative z-40 h-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 w-[85vw] sm:w-[320px]' : '-translate-x-full md:translate-x-0 md:w-[96px]'} p-2 md:pl-4 md:py-4 shrink-0`}>
          <div className={`bg-[#13151A]/90 backdrop-blur-xl border border-white/5 flex flex-col h-full rounded-[24px] md:rounded-[32px] shadow-2xl transition-all duration-300 ${isSidebarOpen ? 'p-4 md:p-5' : 'p-4 md:py-6 md:px-3 items-center'}`}>
            <div className={`flex w-full items-center ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-5'} mb-6 md:mb-8 mt-1`}>
              <div onMouseEnter={(e) => handleMouseEnter(e, "NEO-Z Dashboard")} onMouseLeave={handleMouseLeave} className="flex items-center gap-3 cursor-pointer">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-[#D4AF37] to-[#A88728] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.2)] shrink-0">
                  <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-[#090A0F] rounded-sm rotate-45"></div>
                </div>
                {isSidebarOpen && <h2 className="text-white font-display font-bold text-lg md:text-xl tracking-tight">NEO-Z</h2>}
              </div>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} onMouseEnter={(e) => handleMouseEnter(e, isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar")} onMouseLeave={handleMouseLeave} className="text-[#8B949E] hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-white/5">
                <X size={20} strokeWidth={1.5} className="md:hidden" />
                <Menu size={20} strokeWidth={1.5} className="hidden md:block" />
              </button>
            </div>

            <button onClick={() => createNewChat(null)} onMouseEnter={(e) => handleMouseEnter(e, "New Conversation")} onMouseLeave={handleMouseLeave} className={`w-full bg-white/5 border border-white/10 text-white font-medium ${isSidebarOpen ? 'py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-2' : 'p-3 rounded-xl md:rounded-2xl flex justify-center'} mb-4 md:mb-6 hover:bg-white/10 transition-all text-sm md:text-base shrink-0`}>
              <Plus size={isSidebarOpen ? 16 : 20} strokeWidth={2} className="text-[#D4AF37]" /> 
              {isSidebarOpen && <span>New Conversation</span>}
            </button>

            <div className="flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-hide space-y-4 md:space-y-6">
              <div className="w-full flex flex-col items-center md:items-stretch">
                {isSidebarOpen ? (
                  <div className="flex items-center justify-between px-2 mb-2 md:mb-3">
                    <p className="text-[9px] md:text-[10px] text-[#8B949E] font-bold uppercase tracking-widest">Workspaces</p>
                    <button onClick={() => setIsProjectModalOpen(true)} className="text-[#8B949E] hover:text-[#D4AF37] transition-colors p-1"><Plus size={14}/></button>
                  </div>
                ) : ( <div className="w-8 h-[1px] bg-white/10 mb-4 rounded-full" /> )}
                
                <div className="space-y-1 w-full flex flex-col items-center md:items-stretch">
                  {projects.map(proj => (
                    <div key={proj._id} className="flex flex-col w-full">
                      <div onClick={() => { setActiveProjectId(activeProjectId === proj._id ? null : proj._id); if (!isSidebarOpen && window.innerWidth >= 768) setIsSidebarOpen(true); }} onMouseEnter={(e) => handleMouseEnter(e, proj.name)} onMouseLeave={handleMouseLeave} className={`flex items-center ${isSidebarOpen ? 'gap-2 md:gap-3 px-3 py-2 md:py-2.5 justify-start' : 'justify-center p-2.5 mx-auto'} w-full rounded-lg md:rounded-xl cursor-pointer transition-all ${activeProjectId === proj._id ? "bg-white/10 text-white shadow-inner" : "text-[#8B949E] hover:bg-white/5 hover:text-white"}`}>
                        {activeProjectId === proj._id ? <FolderOpen size={isSidebarOpen ? 14 : 18} strokeWidth={1.5} className="text-[#D4AF37] shrink-0" /> : <Folder size={isSidebarOpen ? 14 : 18} strokeWidth={1.5} className="shrink-0" />}
                        {isSidebarOpen && <span className="font-medium text-xs md:text-sm truncate flex-1">{proj.name}</span>}
                        {isSidebarOpen && <ChevronRight size={12} className={`transition-transform opacity-50 shrink-0 ${activeProjectId === proj._id ? "rotate-90" : ""}`} />}
                      </div>
                      
                      {isSidebarOpen && activeProjectId === proj._id && (
                        <div className="ml-4 md:ml-5 border-l border-white/10 pl-2 md:pl-3 mt-1 space-y-1 py-1 w-full">
                          {projectChats.filter(c => c.projectId === proj._id).map(chat => (
                            <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} className={`group flex items-center justify-between text-[11px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-md md:rounded-lg cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-[#D4AF37]/10" : "text-[#8B949E] hover:text-white hover:bg-white/5"}`}>
                              <span className="truncate font-medium pr-2">{chat.title}</span>
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                                 <button onClick={(e) => { e.stopPropagation(); openShareModal(chat._id); }} className="hover:text-blue-400 p-1"><Share2 size={12} /></button>
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

              <div className="w-full flex flex-col items-center md:items-stretch">
                {isSidebarOpen ? (
                  <p className="text-[9px] md:text-[10px] text-[#8B949E] font-bold uppercase tracking-widest mb-2 md:mb-3 px-2">Recent Threads</p>
                ) : ( <div className="w-8 h-[1px] bg-white/10 mt-2 mb-4 rounded-full" /> )}
                <div className="space-y-1 w-full flex flex-col items-center md:items-stretch">
                  {standaloneChats.map(chat => (
                    <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} onMouseEnter={(e) => handleMouseEnter(e, chat.title)} onMouseLeave={handleMouseLeave} className={`group flex items-center ${isSidebarOpen ? 'justify-between px-3 py-2.5 md:py-3' : 'justify-center p-2.5 mx-auto'} w-full rounded-lg md:rounded-xl cursor-pointer transition-all ${activeChatId === chat._id ? "text-white bg-white/10 shadow-inner" : "text-[#8B949E] hover:text-white hover:bg-white/5"}`}>
                      <div className={`flex items-center ${isSidebarOpen ? 'gap-2 md:gap-3 truncate' : 'justify-center'} w-full`}>
                        <FileText size={isSidebarOpen ? 14 : 18} strokeWidth={1.5} className={`shrink-0 ${activeChatId === chat._id ? "text-[#D4AF37]" : "text-[#8B949E]"}`} />
                        {isSidebarOpen && <span className="truncate font-medium">{chat.title}</span>}
                      </div>
                      {isSidebarOpen && (
                        <div className={`flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0`}>
                          <button onClick={(e) => { e.stopPropagation(); openShareModal(chat._id); }} className="p-1 hover:text-blue-400 transition-all"><Share2 size={14} /></button>
                          <button onClick={(e) => deleteChat(e, chat._id)} className="p-1 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className={`w-full mt-2 md:mt-4 flex ${isSidebarOpen ? 'items-center gap-2 md:gap-3 px-2 md:px-3 pt-3 md:pt-4 border-t border-white/5' : 'flex-col items-center gap-4 pt-4 border-t border-white/5'} text-[#8B949E] shrink-0`}>
              <div onMouseEnter={(e) => handleMouseEnter(e, user?.name || "Profile")} onMouseLeave={handleMouseLeave} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#A88728] text-[#090A0F] flex items-center justify-center text-[10px] md:text-xs font-bold uppercase shrink-0 shadow-lg cursor-pointer">
                {user?.name?.charAt(0) || "Z"}
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-white text-[11px] md:text-xs font-medium truncate">{user?.name || "User Zaid"}</span>
                  <span className="text-[9px] md:text-[10px] truncate opacity-60 font-light">{user?.email || "Pro Tier"}</span>
                </div>
              )}
              <button onClick={handleLogout} onMouseEnter={(e) => handleMouseEnter(e, "Log Out")} onMouseLeave={handleMouseLeave} className="hover:text-red-400 p-1.5 md:p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0" >
                <LogOut size={isSidebarOpen ? 14 : 18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
        
        <div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 lg:px-12 shrink-0 z-10 border-b border-white/5 md:border-none">
          <div className="flex items-center gap-2 md:gap-3 text-white max-w-[70%]">
            {!isSharedView && !isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="text-[#8B949E] hover:text-white transition-colors mr-1 cursor-pointer z-20 md:hidden">
                <Menu size={20} strokeWidth={1.5} />
              </button>
            )}
            {isSharedView && <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shrink-0"><Star size={8}/> Shared View</span>}
            <span className="text-xs md:text-sm font-medium text-[#8B949E] truncate font-display">/ {activeChat?.title || "Shared Conversation"}</span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
             {!isSharedView && (
               <button onClick={() => openShareModal(activeChat?._id)} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-medium text-[#D4AF37] hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-[#D4AF37]/30 hover:border-[#D4AF37] bg-[#D4AF37]/5 transition-all cursor-pointer">
                 <Share size={12} strokeWidth={1.5} /> <span className="hidden sm:inline">Share</span>
               </button>
             )}
          </div>
        </div>

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
               {activeChat.messages.map((c, i) => {
                 const renderText = c.text.includes("[Data File Attached:") 
                    ? c.text.replace(/```json[\s\S]*?```/, "> 📎 **Data File Successfully Processed** *(Raw data hidden for a clean view)*")
                    : c.text;

                 return (
                 <div key={i} className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} w-full`}>
                   <div className="flex items-start gap-3 md:gap-4 max-w-[95%] md:max-w-[85%]">
                      {c.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border border-white/10 bg-[#13151A] text-[#D4AF37] shadow-lg mt-1">
                          <Bot size={16} strokeWidth={1.5} />
                        </div>
                      )}
                      <div className={`text-[15px] leading-relaxed min-w-0 ${c.role === 'user' ? 'bg-[#1A1D24] border border-white/5 px-5 py-3.5 rounded-[24px] rounded-tr-[4px] text-[#EDEDED] shadow-sm break-words' : 'text-[#D1D5DB] font-normal w-full'}`}>
                        <ReactMarkdown 
                           remarkPlugins={[remarkGfm]} 
                           components={{
                             p: ({node, ...props}) => <p className="mb-5 last:mb-0 leading-[1.8] text-[#E2E8F0]" {...props} />,
                             strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                             h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mb-4 mt-6" {...props} />,
                             h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mb-3 mt-5" {...props} />,
                             h3: ({node, ...props}) => <h3 className="text-lg font-medium text-white mb-2 mt-4" {...props} />,
                             ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-5 space-y-2 text-[#E2E8F0]" {...props} />,
                             ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-5 space-y-2 text-[#E2E8F0]" {...props} />,
                             li: ({node, ...props}) => <li className="leading-[1.8]" {...props} />,
                             blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#D4AF37] pl-4 text-sm font-medium text-[#D4AF37]/90 mb-5 bg-[#D4AF37]/5 py-2 rounded-r-lg" {...props} />,
                             code: ({node, inline, children, ...props}) => !inline ? (
                              <div className="w-full bg-[#050505] border border-white/10 rounded-xl overflow-hidden my-6 shadow-2xl">
                                <div className="bg-[#13151A] px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                                  <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
                                  <span className="text-[10px] text-[#8B949E] font-mono ml-2 uppercase tracking-widest">Code Snippet</span>
                                </div>
                                <pre className="p-5 overflow-x-auto text-[#A3B8CC] font-mono text-[13px] md:text-sm leading-loose max-h-80 overflow-y-auto">{children}</pre>
                              </div>
                             ) : <code className="bg-[#D4AF37]/10 px-1.5 py-0.5 rounded-md text-[#D4AF37] font-mono text-[12px] md:text-[13px]" {...props}>{children}</code>
                           }}
                        >
                          {renderText}
                        </ReactMarkdown>
                      </div>
                      {c.role === 'user' && (
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#D4AF37] to-[#A88728] text-[#090A0F] font-bold text-xs mt-1 shadow-lg">
                          {user?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                   </div>
                 </div>
               )})}
               {isTyping && (
                 <div className="flex items-center gap-3 md:gap-4 max-w-[85%]">
                   <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border border-white/10 bg-[#13151A] text-[#D4AF37] shadow-lg">
                      <Bot size={16} strokeWidth={1.5} />
                   </div>
                   <div className="text-[#D4AF37] text-xs font-medium tracking-widest uppercase animate-pulse">Analyzing...</div>
                 </div>
               )}
               <div ref={chatEndRef} className="h-28 md:h-32" /> 
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-4 md:bottom-6 left-0 right-0 px-2 md:px-4 pointer-events-none z-10">
          <div className="max-w-3xl mx-auto w-full pointer-events-auto flex flex-col gap-2 relative">
            
            {/* ✅ AGENT MENTION MENU (THE MAGIC BOX) */}
            {showAgentMenu && (
              <div className="absolute bottom-full left-4 mb-2 w-64 bg-[#13151A]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-4 py-2 border-b border-white/5 bg-white/5">
                  <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-widest">Select Expert</span>
                </div>
                <div className="max-h-48 overflow-y-auto scrollbar-hide py-1">
                   {EXPERT_AGENTS.filter(a => a.name.toLowerCase().includes(agentSearch)).map(agent => (
                     <div key={agent.id} onClick={() => handleSelectAgent(agent.name)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors group">
                       <div className={`p-1.5 rounded-lg ${agent.bg} ${agent.color} group-hover:scale-110 transition-transform`}>
                          <agent.icon size={16} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{agent.name}</span>
                          <span className="text-[10px] text-[#8B949E]">{agent.desc}</span>
                       </div>
                     </div>
                   ))}
                   {EXPERT_AGENTS.filter(a => a.name.toLowerCase().includes(agentSearch)).length === 0 && (
                     <div className="px-4 py-3 text-xs text-[#8B949E]">No experts found.</div>
                   )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 ml-2 md:ml-4 overflow-x-auto scrollbar-hide py-1">
               {hardwarePort && !isSharedView && (
                 <div className="relative shrink-0 bg-[#D4AF37]/10 border border-[#D4AF37]/40 px-3 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.15)] animate-pulse">
                   <Usb size={16} className="text-[#D4AF37]" />
                   <span className="text-[11px] md:text-xs text-[#D4AF37] font-bold uppercase tracking-wider">Board Linked</span>
                   <button type="button" onClick={disconnectHardware} className="ml-2 bg-[#D4AF37] text-[#090A0F] rounded-full p-0.5 hover:bg-red-500 hover:text-white transition-colors shadow-md" title="Disconnect Hardware">
                     <X size={12} strokeWidth={2.5} />
                   </button>
                 </div>
               )}
               {(imagePreview || csvFile) && !isSharedView && (
                  <>
                    {imagePreview && (
                      <div className="relative shrink-0">
                        <img src={imagePreview} alt="Preview" className="h-10 w-10 md:h-12 md:w-12 object-cover rounded-lg md:rounded-xl border border-white/20 shadow-lg" />
                        <button type="button" onClick={() => { setImagePreview(null); setImageBase64(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:scale-110 transition-all shadow-md">
                          <X size={10} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                    {csvFile && (
                      <div className="relative shrink-0 bg-[#1A1D24] border border-[#D4AF37]/30 px-3 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-xl flex items-center gap-2 shadow-lg">
                        <FileSpreadsheet size={16} className="text-[#D4AF37]" />
                        <span className="text-[11px] md:text-xs text-[#EDEDED] max-w-[100px] md:max-w-[150px] truncate font-medium">{csvFile.name}</span>
                        <button type="button" onClick={() => setCsvFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:scale-110 transition-all shadow-md">
                          <X size={10} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </>
               )}
            </div>

            {isSharedView ? (
              <div className="bg-[#13151A]/90 backdrop-blur-2xl rounded-full border border-white/10 p-3 md:p-4 shadow-2xl flex items-center justify-between px-4 md:px-8">
                 <p className="text-[#8B949E] text-xs md:text-sm">Shared, read-only document.</p>
                 <button onClick={() => window.location.href = "/"} className="bg-white text-[#090A0F] font-bold px-4 py-1.5 md:px-6 md:py-2 rounded-full hover:bg-gray-200 transition-all text-xs md:text-sm">
                    Start Chat
                 </button>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="bg-[#13151A]/85 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] border border-white/10 p-1.5 md:p-2 pl-3 md:pl-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center focus-within:border-[#D4AF37]/50 transition-all">
                
                <button type="button" onClick={connectHardware} className={`transition-colors cursor-pointer p-1.5 md:p-2 rounded-full shrink-0 ${hardwarePort ? 'text-[#D4AF37] bg-[#D4AF37]/10' : 'text-[#8B949E] hover:text-[#D4AF37] hover:bg-white/5'}`} title="Link External Hardware">
                  <Usb size={16} strokeWidth={1.5} className="md:w-[18px] md:h-[18px]" />
                </button>

                <button type="button" onClick={() => csvInputRef.current?.click()} className="text-[#8B949E] hover:text-[#D4AF37] transition-colors cursor-pointer p-1.5 md:p-2 hover:bg-white/5 rounded-full shrink-0" title="Upload CSV Data">
                  <FileSpreadsheet size={16} strokeWidth={1.5} className="md:w-[18px] md:h-[18px]" />
                </button>
                <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" />

                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[#8B949E] hover:text-white transition-colors cursor-pointer p-1.5 md:p-2 hover:bg-white/5 rounded-full shrink-0" title="Upload Image">
                  <Paperclip size={16} strokeWidth={1.5} className="md:w-[18px] md:h-[18px]" />
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

                {/* ✅ UPDATED INPUT TAG (Now uses onChange to detect @) */}
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-[#EDEDED] px-3 md:px-4 py-2.5 md:py-3 outline-none placeholder:text-[#8B949E] text-sm md:text-[15px] font-light min-w-0"
                  placeholder={activeChat?.projectId ? "Command Workspace..." : "Type @ to assign an expert or message NEO-Z..."}
                  value={message}
                  onChange={handleMessageChange}
                />
                
                <button type="submit" disabled={!message.trim() && !imageBase64 && !csvFile} className={`w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ml-1 md:ml-2 ${(message.trim() || imageBase64 || csvFile) ? "bg-[#D4AF37] text-[#090A0F] shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:scale-105" : "bg-white/5 text-[#8B949E]"}`}>
                  <Send size={16} strokeWidth={2} className="ml-0.5 md:ml-1 md:w-[18px] md:h-[18px]" />
                </button>
              </form>
            )}
            <p className="text-[8px] md:text-[10px] text-center text-[#8B949E] mt-1 md:mt-2 font-medium tracking-widest uppercase opacity-50">Powered by Gemini Engine</p>
          </div>
        </div>
      </div>

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

      {isShareModalOpen && (
        <div className="absolute inset-0 bg-[#090A0F]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-white/10 p-6 md:p-8 rounded-[24px] md:rounded-[32px] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setIsShareModalOpen(false)} className="absolute top-6 right-6 text-[#8B949E] hover:text-white transition-colors">
              <X size={20} strokeWidth={1.5} />
            </button>
            <h3 className="text-lg md:text-xl font-display font-medium text-white mb-2">Share Link</h3>
            <p className="text-[#8B949E] text-xs md:text-sm mb-6 font-light">Anyone with this link will be able to view this conversation.</p>
            <div className="flex items-center gap-3 mb-6">
              <a href={`https://api.whatsapp.com/send?text=Check%20out%20this%20conversation%20on%20NEO-Z:%20${encodeURIComponent(shareLink)}`} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white flex items-center justify-center transition-all">
                <MessageCircle size={20} strokeWidth={1.5} />
              </a>
              <a href={`mailto:?subject=NEO-Z%20Conversation&body=Check%20out%20this%20AI%20conversation:%20${encodeURIComponent(shareLink)}`} className="w-12 h-12 rounded-full bg-white/5 text-white hover:bg-white/10 flex items-center justify-center transition-all">
                <Mail size={20} strokeWidth={1.5} />
              </a>
            </div>
            <div className="flex items-center bg-[#090A0F] border border-white/10 p-1.5 rounded-xl md:rounded-2xl">
              <input type="text" readOnly value={shareLink} className="flex-1 bg-transparent text-[#EDEDED] px-3 py-2 text-xs md:text-sm outline-none font-mono tracking-tight truncate"/>
              <button onClick={handleCopyLink} className={`p-2.5 rounded-lg md:rounded-xl transition-all flex items-center justify-center shrink-0 ${isCopied ? 'bg-green-500/20 text-green-400' : 'bg-[#D4AF37] text-[#090A0F] hover:opacity-90'}`}>
                {isCopied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;