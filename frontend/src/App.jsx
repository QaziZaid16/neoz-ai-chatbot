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
  Palette, Code2, PenTool, LineChart 
} from "lucide-react";

const API_BASE_URL = "https://neoz-ai-chatbot.onrender.com";

const initialToken = localStorage.getItem("token");
if (initialToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}

const EXPERT_AGENTS = [
  { id: "developer", name: "Developer", icon: Code2, desc: "Logic / Architecture" },
  { id: "designer", name: "Designer", icon: Palette, desc: "Aesthetics / UI" },
  { id: "writer", name: "Writer", icon: PenTool, desc: "Copy / Narrative" },
  { id: "analyst", name: "Analyst", icon: LineChart, desc: "Data / Metrics" },
];

function App() {
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [authMode, setAuthMode] = useState("login"); 
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [notification, setNotification] = useState({ show: false, message: "" });

  const [chats, setChats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [tooltip, setTooltip] = useState({ show: false, text: "", top: 0, left: 0, position: "right" });
  
  const urlParams = new URLSearchParams(window.location.search);
  const sharedChatId = urlParams.get('share');
  const [isSharedView, setIsSharedView] = useState(!!sharedChatId);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [csvFile, setCsvFile] = useState(null); 
  const [hardwarePort, setHardwarePort] = useState(null); 
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const inputRef = useRef(null); 

  const activeChat = chats.find(c => c._id === activeChatId) || chats.find(c => c._id === "temp") || null;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showNotification = (msg) => {
    setNotification({ show: true, message: msg });
    setTimeout(() => setNotification({ show: false, message: "" }), 3500);
  };

  const handleMouseEnter = (e, text, position = "right") => {
    if (window.innerWidth < 768) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.top + (rect.height / 2);
    let left = rect.right + 12;

    if (position === "top") {
      top = rect.top - 12;
      left = rect.left + (rect.width / 2);
    } else if (position === "bottom") {
      top = rect.bottom + 12;
      left = rect.left + (rect.width / 2);
    }
    setTooltip({ show: true, text, top, left, position });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, text: "", top: 0, left: 0, position: "right" });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/signup";
      let res = await axios.post(`${API_BASE_URL}${endpoint}`, authForm);
      let newToken = res.data.token;
      let userData = res.data.user;

      if (authMode === "signup" && !newToken) {
         const loginRes = await axios.post(`${API_BASE_URL}/login`, { email: authForm.email, password: authForm.password });
         newToken = loginRes.data.token;
         userData = loginRes.data.user;
      }
      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      showNotification(authMode === "signup" ? "SIGNAL CREATED. WELCOME." : "NODE CONNECTED.");
    } catch (err) {
      setAuthError(err.response?.data?.error || "AUTHENTICATION FAILED.");
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
    showNotification("CONNECTION TERMINATED.");
  };

  useEffect(() => {
    const fetchData = async () => {
      if (isSharedView) {
        try {
          const res = await axios.get(`${API_BASE_URL}/chat/${sharedChatId}`);
          setChats([res.data]);
          setActiveChatId(res.data._id);
        } catch (err) {
          showNotification("LINK EXPIRED OR INVALID."); 
          setTimeout(() => window.location.href = "/", 2000);
        }
        return; 
      }
      if (token) {
        try {
          const projRes = await axios.get(`${API_BASE_URL}/projects`);
          setProjects(projRes.data);
          const chatRes = await axios.get(`${API_BASE_URL}/chats`);
          const fetchedChats = chatRes.data || [];
          const tempChat = { _id: "temp", title: "Untitled Track", projectId: null, messages: [] };
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

  const handleSelectAgent = (agentName) => {
    const words = message.split(" ");
    words.pop(); 
    const newMessage = words.join(" ") + (words.length > 0 ? " " : "") + `@${agentName} `;
    setMessage(newMessage);
    setShowAgentMenu(false);
    inputRef.current?.focus();
  };

  const openShareModal = (id) => {
    if(id === "temp") return showNotification("START CONVERSATION FIRST."); 
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
    const newChat = { _id: "temp", title: "Untitled Track", projectId: projectId, messages: [] };
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
      showNotification("LABEL CREATED.");
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
        showNotification("DATA ATTACHED.");
      },
      error: function(err) { showNotification("PARSE FAILED: " + err.message); } 
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
      showNotification("WEB SERIAL API NOT SUPPORTED."); 
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setHardwarePort(port);
      setChats(prevChats => prevChats.map(chat => {
        if (chat._id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: "⚡ **HARDWARE PORT OPEN.** AWAITING SIGNAL." }] };
        }
        return chat;
      }));
    } catch (err) {}
  };

  const disconnectHardware = async () => {
    if (hardwarePort) {
      try { await hardwarePort.close(); setHardwarePort(null); showNotification("HARDWARE DISCONNECTED."); } catch (err) {}
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("audio_file", audioBlob, "recording.webm");

        showNotification("ANALYZING VOICE DATA...");
        try {
          const res = await axios.post("https://neoz-python-brain.onrender.com", formData);
          if (res.data.success) {
            setMessage(prev => (prev + " " + res.data.text).trim());
            showNotification("VOICE TRANSCRIBED.");
            inputRef.current?.focus();
          } else {
            showNotification("PROCESSING ERROR. SEE CONSOLE.");
            console.error("Python Server Error:", res.data.error);
          }
        } catch (err) {
          showNotification("PYTHON MICROSERVICE OFFLINE.");
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      showNotification("RECORDING... CLICK MIC TO STOP.");
    } catch (err) {
      showNotification("MICROPHONE ACCESS DENIED.");
    }
  };

  // ✅ UPDATED: LIGHTNING FAST STREAMING SEND MESSAGE
  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() && !imageBase64 && !csvFile) return;

    const baseMsg = message.trim();
    let payloadMsg = baseMsg;
    
    if (csvFile) {
      payloadMsg = `[Data File Attached: ${csvFile.name}]\n\n\`\`\`json\n${csvFile.data}\n\`\`\`\n\nTask: ${baseMsg || "Analyze this data."}`;
    }

    const agentMatch = baseMsg.match(/@(Developer|Designer|Writer|Analyst)/i);
    if (agentMatch) {
        const agent = agentMatch[1];
        payloadMsg = `[System Command: You are now acting strictly as a Senior Expert ${agent}. Tailor your entire response, tone, and formatting to reflect the mindset of a professional ${agent}.]\n\nUser Query: ` + payloadMsg;
    }

    const currentBase64 = imageBase64;
    const currentMimeType = mimeType;
    const currentProjectId = activeChat?.projectId || null;
    
    setMessage("");
    setShowAgentMenu(false); 
    clearAttachments(); 

    // Add User Message Instantly
    const visualMsg = currentBase64 ? `[Image Attached] 🖼️\n${baseMsg}` : baseMsg; 
    setChats(prevChats => prevChats.map(chat => {
      if (chat._id === activeChatId) {
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
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: payloadMsg,
          chatId: activeChatId === "temp" ? null : activeChatId,
          projectId: currentProjectId,
          imageBase64: currentBase64,
          mimeType: currentMimeType,
          hardwareConnected: !!hardwarePort 
        })
      });

      if (!response.ok) {
        if(response.status === 401) handleLogout();
        throw new Error("Network error");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botMessageText = "";
      let realChatId = activeChatId;
      let isFirstChunk = true;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                
                if (data.init) {
                  // DB mein save hone ke baad real ID aayi hai
                  realChatId = data.chat._id;
                  setActiveChatId(realChatId); 
                  setChats(prev => {
                    const filtered = prev.filter(c => c._id !== "temp" && c._id !== realChatId);
                    return [data.chat, ...filtered].map(c => {
                       if (c._id === realChatId) {
                           // Bot ka empty message add karo stream capture karne ke liye
                           return { ...c, messages: [...c.messages, {role: "bot", text: ""}] }; 
                       }
                       return c;
                    });
                  });
                } else if (data.chunk) {
                  setIsTyping(false); // Jaise hi pehla word aaye, loading indicator hide kar do
                  botMessageText += data.chunk;
                  setChats(prev => prev.map(c => {
                    if (c._id === realChatId) {
                      const newMessages = [...c.messages];
                      newMessages[newMessages.length - 1].text = botMessageText;
                      return { ...c, messages: newMessages };
                    }
                    return c;
                  }));
                } else if (data.done) {
                  // Hardware CMD Handle
                  if (hardwarePort) {
                     const cmdMatch = botMessageText.match(/<CMD>(.*?)<\/CMD>/);
                     if (cmdMatch && cmdMatch[1]) {
                         const writer = hardwarePort.writable.getWriter();
                         const encoder = new TextEncoder();
                         writer.write(encoder.encode(cmdMatch[1] + "\n")).then(() => writer.releaseLock());
                     }
                  }
                } else if (data.error) {
                    showNotification(data.error);
                }
              } catch (e) {
                console.error("Stream parse error", e, dataStr);
              }
            }
          }
        }
      }
    } catch (err) {
      setChats(prev => prev.map(chat => {
        if (chat._id === activeChatId) {
          return { ...chat, messages: [...chat.messages, { role: "bot", text: "⚠️ **ERROR:** SIGNAL LOST OR NETWORK SLOW." }] };
        }
        return chat;
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const projectChats = chats.filter(c => c.projectId !== null && c._id !== "temp");
  const standaloneChats = chats.filter(c => c.projectId === null && c._id !== "temp");
  const today = new Date();
  const dateString = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const NotificationToast = () => {
    if (!notification.show) return null;
    return (
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[999] bg-[#111] border-2 border-[#D31010] py-3 px-6 shadow-[6px_6px_0px_#D31010] animate-in slide-in-from-top-4 flex items-center gap-4">
        <span className="text-[#D31010] font-black text-xl leading-none">!</span>
        <span className="text-white font-black uppercase tracking-widest text-xs">{notification.message}</span>
      </div>
    );
  };

  if (!token && !isSharedView) {
    return (
      <div className="min-h-screen w-screen bg-[#111111] text-[#E5E5E5] flex items-center justify-center relative overflow-hidden px-4 py-8 font-sans selection:bg-[#D31010] selection:text-white">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
        <NotificationToast />

        <div className="border border-[#333] bg-[#0A0A0A] p-8 md:p-12 w-full max-w-md relative z-10">
          <div className="absolute top-4 right-4 text-[#D31010] text-xl font-black tracking-widest leading-none">X X</div>
          <div className="flex flex-col mb-10 border-b border-[#333] pb-6">
            <h2 className="text-[#D31010] font-black uppercase text-5xl tracking-tighter leading-none mb-2">NEO-Z.</h2>
            <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-widest w-full">
              <span>System Node.</span>
              <span>{dateString}</span>
            </div>
          </div>
          <h3 className="text-xl font-black text-white uppercase mb-2">{authMode === "login" ? "ENTER THE DARKLANDS" : "INITIALIZE NODE"}</h3>
          <p className="text-gray-500 text-xs mb-8 font-medium uppercase tracking-widest">{authMode === "login" ? "IDENTIFY YOURSELF." : "CREATE YOUR SIGNAL."}</p>
          {authError && <div className="bg-[#D31010] text-white p-3 text-xs mb-6 font-bold uppercase tracking-widest border border-red-900">{authError}</div>}
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="text-[10px] text-[#D31010] font-bold uppercase tracking-widest mb-1 block">Full Name.</label>
                <input type="text" required value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 outline-none focus:border-[#D31010] transition-colors font-medium rounded-none"/>
              </div>
            )}
            <div>
              <label className="text-[10px] text-[#D31010] font-bold uppercase tracking-widest mb-1 block">Email Address.</label>
              <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 outline-none focus:border-[#D31010] transition-colors font-medium rounded-none"/>
            </div>
            <div>
              <label className="text-[10px] text-[#D31010] font-bold uppercase tracking-widest mb-1 block">Password.</label>
              <input type="password" required value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 outline-none focus:border-[#D31010] transition-colors font-medium rounded-none"/>
            </div>
            <button type="submit" disabled={isAuthLoading} className="w-full bg-[#D31010] text-white font-black uppercase tracking-widest text-sm py-4 mt-6 hover:bg-white hover:text-black transition-all disabled:opacity-50">
              {isAuthLoading ? "PROCESSING..." : (authMode === "login" ? "CONNECT" : "REGISTER")}
            </button>
          </form>

          <div className="h-4 w-full mt-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, #D31010, #D31010 2px, transparent 2px, transparent 8px)'}}></div>
          <div className="mt-6 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">
            {authMode === "login" ? "NO SIGNAL?" : "ALREADY REGISTERED?"}
            <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }} className="text-white hover:text-[#D31010] ml-2 underline decoration-[#D31010] underline-offset-4 transition-colors">
              {authMode === "login" ? "CREATE ONE." : "LOGIN."}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#111111] text-[#E5E5E5] flex overflow-hidden relative font-sans selection:bg-[#D31010] selection:text-white">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay z-0" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>

      <NotificationToast />

      {tooltip.show && (
        <div className="fixed z-[100] px-3 py-1.5 bg-[#D31010] text-white text-[10px] font-black uppercase tracking-widest rounded-none pointer-events-none whitespace-nowrap shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border border-[#555]"
          style={{ top: tooltip.top, left: tooltip.left, transform: tooltip.position === "top" ? 'translate(-50%, -100%)' : tooltip.position === "bottom" ? 'translate(-50%, 0)' : 'translateY(-50%)' }}>
          {tooltip.text}
        </div>
      )}

      {!isSharedView && isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {!isSharedView && (
        <div className={`fixed md:relative z-40 h-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 w-[85vw] sm:w-[320px]' : '-translate-x-full md:translate-x-0 md:w-[80px]'} bg-[#0A0A0A] border-r border-[#333] shrink-0`}>
          <div className="flex flex-col h-full p-4 md:p-6">
            <div className={`flex w-full items-center ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-6'} mb-8 pb-6 border-b border-[#333]`}>
              <div onMouseEnter={(e) => handleMouseEnter(e, "SYSTEM DASHBOARD")} onMouseLeave={handleMouseLeave} className="flex items-center gap-3 cursor-pointer">
                <div className="text-[#D31010] font-black text-2xl leading-none tracking-tighter">N.</div>
                {isSidebarOpen && <h2 className="text-[#D31010] font-black uppercase text-2xl tracking-tighter leading-none mt-1">NEO-Z</h2>}
              </div>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} onMouseEnter={(e) => handleMouseEnter(e, isSidebarOpen ? "COLLAPSE PANEL" : "EXPAND PANEL")} onMouseLeave={handleMouseLeave} className="text-gray-500 hover:text-white transition-colors">
                <X size={24} strokeWidth={2} className="md:hidden" />
                <Menu size={24} strokeWidth={2} className="hidden md:block" />
              </button>
            </div>

            <button onClick={() => createNewChat(null)} onMouseEnter={(e) => handleMouseEnter(e, "INITIALIZE NEW TRACK")} onMouseLeave={handleMouseLeave} className={`w-full border border-[#D31010] text-[#D31010] hover:bg-[#D31010] hover:text-white font-black uppercase tracking-widest text-xs ${isSidebarOpen ? 'py-3 flex items-center justify-center gap-2' : 'p-3 flex justify-center'} mb-8 transition-colors shrink-0`}>
              <Plus size={isSidebarOpen ? 16 : 20} strokeWidth={3}/> 
              {isSidebarOpen && <span>NEW TRACK</span>}
            </button>

            <div className="flex-1 w-full overflow-y-auto scrollbar-hide space-y-8">
              <div className="w-full flex flex-col items-center md:items-stretch">
                {isSidebarOpen ? (
                  <div className="flex items-center justify-between mb-4 border-b border-[#333] pb-2">
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">RECORD LABELS.</p>
                    <button onClick={() => setIsProjectModalOpen(true)} onMouseEnter={(e) => handleMouseEnter(e, "CREATE LABEL")} onMouseLeave={handleMouseLeave} className="text-gray-500 hover:text-[#D31010]"><Plus size={14} strokeWidth={3}/></button>
                  </div>
                ) : ( <div className="w-full h-px bg-[#333] mb-6" /> )}
                <div className="space-y-1 w-full flex flex-col items-center md:items-stretch">
                  {projects.map(proj => (
                    <div key={proj._id} className="flex flex-col w-full">
                      <div onClick={() => { setActiveProjectId(activeProjectId === proj._id ? null : proj._id); if (!isSidebarOpen && window.innerWidth >= 768) setIsSidebarOpen(true); }} onMouseEnter={(e) => handleMouseEnter(e, `OPEN: ${proj.name}`)} onMouseLeave={handleMouseLeave} className={`flex items-center ${isSidebarOpen ? 'gap-3 px-2 py-2 justify-start' : 'justify-center p-3 mx-auto'} w-full cursor-pointer transition-colors ${activeProjectId === proj._id ? "bg-[#111] text-[#D31010] border-l-2 border-[#D31010]" : "text-gray-500 hover:bg-[#111] hover:text-white border-l-2 border-transparent"}`}>
                        {activeProjectId === proj._id ? <FolderOpen size={16} strokeWidth={2} className="shrink-0" /> : <Folder size={16} strokeWidth={2} className="shrink-0" />}
                        {isSidebarOpen && <span className="font-bold text-sm tracking-wide truncate flex-1 uppercase">{proj.name}</span>}
                        {isSidebarOpen && <ChevronRight size={14} strokeWidth={2.5} className={`transition-transform shrink-0 ${activeProjectId === proj._id ? "rotate-90 text-[#D31010]" : ""}`} />}
                      </div>
                      {isSidebarOpen && activeProjectId === proj._id && (
                        <div className="ml-2 border-l border-[#333] pl-3 mt-1 space-y-1 py-2 w-full">
                          {projectChats.filter(c => c.projectId === proj._id).map(chat => (
                            <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} className={`group flex items-center justify-between text-xs px-2 py-2 cursor-pointer transition-colors ${activeChatId === chat._id ? "text-white bg-[#D31010]/10 font-bold" : "text-gray-500 hover:text-white hover:bg-[#111] font-medium"}`}>
                              <span className="truncate pr-2 uppercase">{chat.title}</span>
                              <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                                 <button onClick={(e) => { e.stopPropagation(); openShareModal(chat._id); }} onMouseEnter={(e) => handleMouseEnter(e, "PUBLISH")} onMouseLeave={handleMouseLeave} className="hover:text-white"><Share2 size={12}/></button>
                                 <button onClick={(e) => deleteChat(e, chat._id)} onMouseEnter={(e) => handleMouseEnter(e, "DELETE")} onMouseLeave={handleMouseLeave} className="hover:text-[#D31010]"><Trash2 size={12}/></button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => createNewChat(proj._id)} className="text-[10px] font-black tracking-widest text-[#D31010] px-2 py-2 hover:bg-[#111] w-full text-left transition-colors mt-2 uppercase">+ ADD TRACK</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full flex flex-col items-center md:items-stretch">
                {isSidebarOpen ? (
                   <div className="flex items-center justify-between mb-4 border-b border-[#333] pb-2">
                     <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">SINGLES.</p>
                   </div>
                ) : ( <div className="w-full h-px bg-[#333] mb-6" /> )}
                <div className="space-y-1 w-full flex flex-col items-center md:items-stretch">
                  {standaloneChats.map(chat => (
                    <div key={chat._id} onClick={() => selectChatMobileFriendly(chat._id)} onMouseEnter={(e) => handleMouseEnter(e, chat.title)} onMouseLeave={handleMouseLeave} className={`group flex items-center ${isSidebarOpen ? 'justify-between px-2 py-2.5' : 'justify-center p-3 mx-auto'} w-full cursor-pointer transition-colors border-l-2 ${activeChatId === chat._id ? "bg-[#111] border-[#D31010] text-white" : "border-transparent text-gray-500 hover:text-white hover:bg-[#111]"}`}>
                      <div className={`flex items-center ${isSidebarOpen ? 'gap-3 truncate' : 'justify-center'} w-full`}>
                        <FileText size={16} strokeWidth={2} className={`shrink-0 ${activeChatId === chat._id ? "text-[#D31010]" : ""}`} />
                        {isSidebarOpen && <span className="truncate font-bold text-sm tracking-wide uppercase">{chat.title}</span>}
                      </div>
                      {isSidebarOpen && (
                        <div className={`flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0`}>
                          <button onClick={(e) => { e.stopPropagation(); openShareModal(chat._id); }} onMouseEnter={(e) => handleMouseEnter(e, "PUBLISH")} onMouseLeave={handleMouseLeave} className="hover:text-white"><Share2 size={14} strokeWidth={2}/></button>
                          <button onClick={(e) => deleteChat(e, chat._id)} onMouseEnter={(e) => handleMouseEnter(e, "DELETE")} onMouseLeave={handleMouseLeave} className="hover:text-[#D31010]"><Trash2 size={14} strokeWidth={2}/></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`w-full mt-6 pt-5 border-t border-[#333] flex ${isSidebarOpen ? 'items-center gap-4' : 'flex-col items-center gap-4'} shrink-0`}>
              <div onMouseEnter={(e) => handleMouseEnter(e, "IDENTITY")} onMouseLeave={handleMouseLeave} className="w-10 h-10 bg-[#D31010] flex items-center justify-center text-white font-black text-sm uppercase shrink-0 cursor-pointer">
                {user?.name?.charAt(0) || "Z"}
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-white text-xs font-black tracking-widest truncate uppercase">{user?.name || "QAZI ZAID"}</span>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-0.5">{user?.email || "PRO TIER"}</span>
                </div>
              )}
              <button onClick={handleLogout} onMouseEnter={(e) => handleMouseEnter(e, "TERMINATE CONNECTION")} onMouseLeave={handleMouseLeave} className="text-gray-500 hover:text-[#D31010] transition-colors cursor-pointer" title="Log Out">
                <LogOut size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col relative min-w-0 z-10">
        <div className="h-16 md:h-24 flex items-center justify-between px-6 md:px-12 shrink-0 border-b border-[#333] bg-[#0A0A0A]">
          <div className="flex items-center gap-4 text-white max-w-[70%]">
            {!isSharedView && !isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500 hover:text-white md:hidden">
                <Menu size={24} strokeWidth={2} />
              </button>
            )}
            {isSharedView && <span className="bg-[#D31010] text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Star size={12} strokeWidth={3}/> SHARED</span>}
            <div className="flex flex-col">
               <span className="text-[10px] text-[#D31010] font-black uppercase tracking-widest mb-0.5">CURRENT TRACK.</span>
               <span className="text-sm md:text-lg font-black text-white uppercase tracking-wider truncate">{activeChat?.title || "UNTITLED"}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 shrink-0 hidden md:flex">
             <div className="flex flex-col text-right">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-0.5">DATE.</span>
                <span className="text-sm font-black text-white uppercase tracking-wider">{dateString}</span>
             </div>
             {!isSharedView && (
               <button onClick={() => openShareModal(activeChat?._id)} onMouseEnter={(e) => handleMouseEnter(e, "BROADCAST TO NETWORK", "bottom")} onMouseLeave={handleMouseLeave} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D31010] border border-[#D31010] px-4 py-2 hover:bg-[#D31010] hover:text-white transition-all ml-4">
                 <Share size={14} strokeWidth={2.5} /> <span>PUBLISH</span>
               </button>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative px-4 md:px-12">
          {(!activeChat || activeChat.messages.length === 0) ? (
            <div className="h-full flex flex-col items-start justify-center p-4 max-w-4xl mx-auto w-full mt-[-5vh]">
               <div className="absolute top-10 right-10 text-[#D31010] font-black text-2xl hidden md:block">X X X</div>
               <div className="flex mb-8">
                  <div className="flex flex-col text-white/10 font-black leading-none mr-6 text-2xl">
                     <span>+</span><span>+</span><span>+</span><span>+</span>
                  </div>
                  <div>
                     <h1 className="text-6xl md:text-8xl lg:text-9xl font-black uppercase leading-[0.85] tracking-tighter text-white">
                       THE<br/>NEO-Z<br/><span className="text-[#D31010]">CHAIN.</span>
                     </h1>
                  </div>
               </div>
               <div className="border-l-4 border-[#D31010] pl-6 mt-4 max-w-xl">
                  <p className="text-sm md:text-base text-gray-400 font-medium uppercase tracking-widest leading-relaxed">
                     <span className="text-[#D31010] font-black">All responses generated by</span><br/>
                     the advanced Gemini Neural Engine. Enter your prompt below to initiate the sequence.
                  </p>
               </div>
               <div className="h-6 w-full max-w-2xl mt-12 opacity-50" style={{backgroundImage: 'repeating-linear-gradient(45deg, #D31010, #D31010 4px, transparent 4px, transparent 12px)'}}></div>
            </div>
          ) : (
            <div className="py-8 md:py-16 space-y-10 md:space-y-16 max-w-5xl mx-auto w-full">
               {activeChat.messages.map((c, i) => {
                 const renderText = c.text.includes("[Data File Attached:") 
                    ? c.text.replace(/```json[\s\S]*?```/, "> 📎 **DATA FILE PROCESSED**\n> *(Raw metric data concealed for clarity)*")
                    : c.text;
                 return (
                 <div key={i} className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} w-full`}>
                   <div className={`flex items-start gap-4 md:gap-6 max-w-[95%] md:max-w-[85%] ${c.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center font-black uppercase text-sm mt-1 ${c.role === 'user' ? 'bg-[#D31010] text-white' : 'border border-[#555] text-gray-300'}`}>
                        {c.role === 'user' ? (user?.name?.charAt(0) || 'U') : <Bot size={20} strokeWidth={2} />}
                      </div>
                      <div className={`text-sm md:text-base leading-relaxed min-w-0 ${c.role === 'user' ? 'bg-[#D31010] text-white p-5 md:p-6' : 'border border-[#333] bg-[#0F0F0F] text-gray-300 p-5 md:p-8'}`}>
                        <ReactMarkdown 
                           remarkPlugins={[remarkGfm]} 
                           components={{
                             p: ({node, ...props}) => <p className="mb-5 last:mb-0 tracking-wide inline-block" {...props} />,
                             strong: ({node, ...props}) => <strong className={`font-black uppercase tracking-wider ${c.role==='user'?'text-black':'text-white'}`} {...props} />,
                             h1: ({node, ...props}) => <h1 className="text-3xl md:text-4xl font-black uppercase mb-6 mt-8 tracking-tighter text-white border-b border-[#333] pb-2" {...props} />,
                             h2: ({node, ...props}) => <h2 className="text-2xl md:text-3xl font-black uppercase mb-4 mt-6 tracking-tight text-[#D31010]" {...props} />,
                             h3: ({node, ...props}) => <h3 className="text-xl font-bold uppercase mb-3 mt-5 text-white" {...props} />,
                             ul: ({node, ...props}) => <ul className="list-square pl-6 mb-5 space-y-3 marker:text-[#D31010]" {...props} />,
                             ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-5 space-y-3 font-bold" {...props} />,
                             li: ({node, ...props}) => <li className="" {...props} />,
                             blockquote: ({node, ...props}) => <blockquote className={`border-l-4 pl-5 py-1 font-bold uppercase italic my-6 ${c.role==='user'?'border-black text-black':'border-[#D31010] text-gray-400'}`} {...props} />,
                             code: ({node, inline, children, ...props}) => !inline ? (
                              <div className="w-full bg-[#050505] border border-[#333] my-8 relative">
                                <div className="absolute -top-3 -right-3 text-[#D31010] font-black text-sm">X X</div>
                                <div className="bg-[#111] px-5 py-3 border-b border-[#333]">
                                  <span className="text-[10px] text-[#D31010] font-black uppercase tracking-widest">SYSTEM_CODE.EXE</span>
                                </div>
                                <pre className="p-6 overflow-x-auto text-[#ccc] font-mono text-sm leading-loose max-h-96">{children}</pre>
                              </div>
                             ) : <code className={`px-1.5 py-0.5 font-bold font-mono text-sm uppercase tracking-wider ${c.role==='user'?'bg-black text-[#D31010]':'text-[#D31010]'}`} {...props}>{children}</code>
                           }}
                        >
                          {renderText}
                        </ReactMarkdown>
                        {/* Cursor blink effect for streaming chunk */}
                        {isTyping && i === activeChat.messages.length - 1 && c.role === 'bot' && (
                           <span className="inline-block w-2 h-4 bg-[#D31010] ml-1 animate-pulse align-middle"></span>
                        )}
                      </div>
                   </div>
                 </div>
               )})}
               {/* Show initial pulse when waiting for first chunk */}
               {isTyping && activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].role === 'user' && (
                 <div className="flex items-start gap-6 max-w-[85%]">
                   <div className="w-10 h-10 border border-[#555] text-gray-300 flex-shrink-0 flex items-center justify-center mt-1">
                      <Bot size={20} strokeWidth={2} />
                   </div>
                   <div className="border border-[#333] bg-[#0F0F0F] p-6">
                     <div className="text-[#D31010] font-black uppercase tracking-widest text-xs animate-pulse flex items-center gap-3">
                       <span>TRANSMITTING</span>
                       <span className="text-white text-lg leading-none">+ + +</span>
                     </div>
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} className="h-32 md:h-40" /> 
            </div>
          )}
        </div>

        {/* ✅ INPUT AREA */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent pt-12 pb-6 px-4 md:px-12 z-20">
          <div className="max-w-5xl mx-auto w-full flex flex-col gap-3 relative">
            
            {showAgentMenu && (
              <div className="absolute bottom-[calc(100%+16px)] left-0 w-80 bg-[#111] border border-[#333] shadow-2xl z-50">
                <div className="px-5 py-4 border-b border-[#333] flex justify-between items-center bg-[#0A0A0A]">
                  <span className="text-[10px] font-black text-[#D31010] uppercase tracking-widest">OVERRIDE PROTOCOL</span>
                  <span className="text-gray-600 text-xs font-black">X X</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                   {EXPERT_AGENTS.filter(a => a.name.toLowerCase().includes(agentSearch)).map(agent => (
                     <div key={agent.id} onClick={() => handleSelectAgent(agent.name)} className="flex items-center gap-5 px-5 py-4 hover:bg-[#D31010] cursor-pointer transition-colors group border-b border-[#222] last:border-0">
                       <div className={`p-0 text-gray-500 group-hover:text-white transition-colors`}>
                          <agent.icon size={20} strokeWidth={2}/>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-white uppercase tracking-wider">{agent.name}</span>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest group-hover:text-white/70">{agent.desc}</span>
                       </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-2">
               {hardwarePort && !isSharedView && (
                 <div className="relative shrink-0 border border-[#D31010] bg-[#111] px-5 py-3 flex items-center gap-4">
                   <Usb size={18} className="text-[#D31010]" strokeWidth={2} />
                   <div className="flex flex-col">
                     <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">PORT OPEN</span>
                     <span className="text-xs text-white font-black uppercase tracking-wider">HARDWARE LINKED</span>
                   </div>
                   <button onClick={disconnectHardware} onMouseEnter={(e) => handleMouseEnter(e, "SEVER LINK", "top")} onMouseLeave={handleMouseLeave} className="ml-4 bg-[#D31010] text-white p-1.5 hover:bg-white hover:text-black transition-colors">
                     <X size={14} strokeWidth={3} />
                   </button>
                 </div>
               )}
               {(imagePreview || csvFile) && !isSharedView && (
                  <>
                    {imagePreview && (
                      <div className="relative shrink-0 border border-[#333] bg-[#111] p-1">
                        <img src={imagePreview} alt="Preview" className="h-14 w-14 object-cover grayscale" />
                        <button type="button" onClick={() => { setImagePreview(null); setImageBase64(null); }} onMouseEnter={(e) => handleMouseEnter(e, "REMOVE VISUAL", "top")} onMouseLeave={handleMouseLeave} className="absolute -top-3 -right-3 bg-[#D31010] text-white p-1.5 hover:bg-white hover:text-black transition-colors">
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    )}
                    {csvFile && (
                      <div className="relative shrink-0 bg-[#111] border border-[#333] px-5 py-4 flex items-center gap-4">
                        <FileSpreadsheet size={20} className="text-[#D31010]" strokeWidth={2}/>
                        <div className="flex flex-col">
                           <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">DATA ATTACHED</span>
                           <span className="text-xs text-white max-w-[150px] truncate font-black uppercase tracking-wider">{csvFile.name}</span>
                        </div>
                        <button type="button" onClick={() => setCsvFile(null)} onMouseEnter={(e) => handleMouseEnter(e, "REMOVE DATA", "top")} onMouseLeave={handleMouseLeave} className="absolute -top-3 -right-3 bg-[#D31010] text-white p-1.5 hover:bg-white hover:text-black transition-colors">
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    )}
                  </>
               )}
            </div>

            {isSharedView ? (
              <div className="border border-[#333] bg-[#111] p-5 flex items-center justify-between">
                 <p className="text-[#D31010] font-black uppercase tracking-widest text-xs">READ-ONLY ARCHIVE.</p>
                 <button onClick={() => window.location.href = "/"} className="bg-white text-black font-black px-8 py-3 uppercase tracking-widest text-xs hover:bg-[#D31010] hover:text-white transition-colors">
                    INITIALIZE NEW
                 </button>
              </div>
            ) : (
              <form onSubmit={sendMessage} className="bg-[#0A0A0A] border border-[#444] p-1.5 flex items-center focus-within:border-white transition-colors relative">
                
                <button type="button" onClick={toggleRecording} onMouseEnter={(e) => handleMouseEnter(e, isRecording ? "STOP RECORDING" : "START VOICE INPUT", "top")} onMouseLeave={handleMouseLeave} className={`p-4 transition-colors shrink-0 ${isRecording ? 'text-[#D31010] bg-[#D31010]/20 animate-pulse border border-[#D31010]' : 'text-gray-500 hover:text-white'}`} title="Record Voice">
                  <Mic size={22} strokeWidth={2} />
                </button>
                <div className="w-px h-6 bg-[#333]"></div>
                
                <button type="button" onClick={connectHardware} onMouseEnter={(e) => handleMouseEnter(e, "LINK HARDWARE", "top")} onMouseLeave={handleMouseLeave} className={`p-4 transition-colors shrink-0 ${hardwarePort ? 'text-[#D31010]' : 'text-gray-500 hover:text-white'}`}>
                  <Usb size={22} strokeWidth={2} />
                </button>
                <div className="w-px h-6 bg-[#333]"></div>
                <button type="button" onClick={() => csvInputRef.current?.click()} onMouseEnter={(e) => handleMouseEnter(e, "ATTACH DATA FILE", "top")} onMouseLeave={handleMouseLeave} className="p-4 transition-colors text-gray-500 hover:text-white shrink-0">
                  <FileSpreadsheet size={22} strokeWidth={2} />
                </button>
                <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} onMouseEnter={(e) => handleMouseEnter(e, "ATTACH VISUALS", "top")} onMouseLeave={handleMouseLeave} className="p-4 transition-colors text-gray-500 hover:text-white shrink-0">
                  <Paperclip size={22} strokeWidth={2} />
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-white px-6 py-4 outline-none font-bold placeholder:text-gray-600 placeholder:uppercase placeholder:font-black placeholder:tracking-widest text-sm md:text-base min-w-0"
                  placeholder={activeChat?.projectId ? "COMMAND THE WORKSPACE..." : "TYPE @ FOR PROTOCOL OR ENTER PROMPT..."}
                  value={message}
                  onChange={handleMessageChange}
                  disabled={isRecording}
                />
                
                <button type="submit" disabled={(!message.trim() && !imageBase64 && !csvFile) || isRecording} onMouseEnter={(e) => handleMouseEnter(e, "TRANSMIT", "top")} onMouseLeave={handleMouseLeave} className={`px-8 py-4 uppercase font-black tracking-widest text-sm transition-colors shrink-0 ${(message.trim() || imageBase64 || csvFile) ? "bg-[#D31010] text-white hover:bg-white hover:text-black" : "bg-[#111] text-gray-600 border-l border-[#333]"}`}>
                  SEND
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {isProjectModalOpen && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-[#333] p-10 w-full max-w-md relative">
            <button onClick={() => setIsProjectModalOpen(false)} className="absolute top-4 right-4 text-[#D31010] font-black text-xl hover:text-white transition-colors">X X</button>
            <h3 className="text-2xl font-black text-white uppercase mb-8 tracking-tighter">NEW LABEL.</h3>
            <form onSubmit={handleCreateProject}>
              <label className="text-[10px] text-[#D31010] font-bold uppercase tracking-widest mb-2 block">Designation.</label>
              <input type="text" placeholder="E.G. PROJECT OMEGA" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} autoFocus className="w-full bg-[#111] border border-[#333] text-white px-5 py-4 mb-8 outline-none focus:border-[#D31010] transition-colors font-bold uppercase placeholder:text-gray-600"/>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-6 py-3 text-gray-500 font-black uppercase hover:text-white transition-colors">ABORT</button>
                <button type="submit" disabled={!newProjectName.trim()} className="px-8 py-3 bg-[#D31010] text-white font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50">CREATE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-[#333] p-10 w-full max-w-md relative">
            <button onClick={() => setIsShareModalOpen(false)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors">
              <X size={24} strokeWidth={2} />
            </button>
            <h3 className="text-2xl font-black text-white uppercase mb-2 tracking-tighter">TRANSMIT SIGNAL.</h3>
            <p className="text-[#D31010] text-[10px] font-black uppercase tracking-widest mb-8">Broadcast this frequency to the network.</p>
            
            <div className="flex items-center gap-4 mb-8">
              <a href={`https://api.whatsapp.com/send?text=LISTEN%20TO%20THIS:%20${encodeURIComponent(shareLink)}`} target="_blank" rel="noopener noreferrer" className="w-16 h-16 bg-[#111] border border-[#333] text-white hover:border-[#25D366] hover:text-[#25D366] flex items-center justify-center transition-colors">
                <MessageCircle size={28} strokeWidth={2} />
              </a>
              <a href={`mailto:?subject=NEO-Z%20TRANSMISSION&body=Link:%20${encodeURIComponent(shareLink)}`} className="w-16 h-16 bg-[#111] border border-[#333] text-white hover:border-white hover:text-white flex items-center justify-center transition-colors">
                <Mail size={28} strokeWidth={2} />
              </a>
            </div>

            <div className="flex items-center bg-[#111] border border-[#333]">
              <input type="text" readOnly value={shareLink} className="flex-1 bg-transparent text-gray-400 px-4 py-4 text-sm outline-none font-mono tracking-tighter truncate"/>
              <button onClick={handleCopyLink} className={`px-6 py-4 font-black uppercase tracking-widest transition-colors flex items-center justify-center shrink-0 border-l border-[#333] ${isCopied ? 'bg-white text-black' : 'bg-[#D31010] text-white hover:bg-white hover:text-black'}`}>
                {isCopied ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;