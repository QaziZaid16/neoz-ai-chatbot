# 🔴 NEO-Z : Advanced AI Workspace

![NEO-Z Banner](https://via.placeholder.com/1000x300/0A0A0A/D31010?text=N+E+O+-+Z+.+S+Y+S+T+E+M)

NEO-Z is a cinematic AI workspace and chatbot application. It uses a Node.js backend with MongoDB for auth/chat storage, OpenRouter for text generation, Gemini for image analysis, and an optional Python microservice for voice/audio tasks.

### 🚀 Live Deployments
* **Frontend UI (Vercel):** [https://neoz-ai-chatbot.vercel.app](https://neoz-ai-chatbot.vercel.app)
* **Core Node API (Render):** `Live`
* **Python Microservice (Docker/Render):** `Live`

---

## ⚡ Key Features

* **Cinematic Hacker UI:** Custom dark-themed interface built with React and Tailwind CSS.
* **Real-Time Streaming:** Text responses stream from OpenRouter with Server-Sent Events (SSE).
* **Hardware Protocol:** Native Web Serial API support for connected hardware via custom `<CMD>` tags.
* **Data & Vision Processing:** Upload images for visual analysis or attach CSV files for bulk data interpretation.
* **Dual-Brain Architecture:**
  * Node.js handles auth, persistence, and streaming responses.
  * OpenRouter handles text prompts; Gemini handles image prompts.
  * A Python microservice remains available for heavy audio/data tasks.
* **Accessibility & UX:** Narrated AI responses, one-click clipboard copying, and a responsive dashboard layout.

---

## 🛠️ Technology Stack

**Frontend:**
* React (Vite)
* Tailwind CSS
* React Markdown and remark-gfm
* Web Speech API and Web Serial API

**Core Backend:**
* Node.js and Express
* MongoDB
* OpenRouter (`google/gemma-4-31b-it` by default)
* Google Generative AI (`gemini-1.5-flash` for image prompts)

**Python Microservice:**
* FastAPI
* Docker
* SpeechRecognition and Pydub

---

## ⚙️ Local Development Setup

### Prerequisites
* Node.js 18+
* Python 3.13+
* MongoDB URI
* OpenRouter API key
* Gemini API key
* JWT secret
* Docker is optional for the Python microservice

### 1. Clone the Repository
```bash
git clone https://github.com/QaziZaid16/neoz-ai-chatbot.git
cd neoz-ai-chatbot
```

### 2. Setup Core Backend
```bash
cd backend
npm install
# Create a .env file with MONGO_URI (or MONGODB_URI), OPENROUTER_API_KEY, GEMINI_API_KEY, and JWT_SECRET
npm start
```

### 3. Setup Frontend
```bash
cd frontend
npm install
# API_BASE_URL auto-detects localhost; set VITE_API_BASE_URL only if you need a custom backend URL
npm run dev
```

### 4. Optional Python Microservice
```bash
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 🔧 Runtime Notes

* Text prompts go through OpenRouter with `google/gemma-4-31b-it` by default.
* Image prompts go through Gemini (`gemini-1.5-flash`).
* The frontend uses `http://localhost:5000` automatically during local development.
* The backend prints debug logs for auth, project/chat loading, and streaming requests.

---

## 🤝 Author
Built and designed by **Qazi Zaid**.
