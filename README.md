# 🔴 NEO-Z : Advanced AI Workspace

![NEO-Z Banner](https://via.placeholder.com/1000x300/0A0A0A/D31010?text=N+E+O+-+Z+.+S+Y+S+T+E+M)

NEO-Z is a highly advanced, cinematic AI workspace and chatbot application. Built with a distributed microservices architecture, it seamlessly integrates conversational AI, hardware serial communication, data file processing (CSV), and a dedicated Python engine for heavy computational tasks.

### 🚀 Live Deployments
* **Frontend UI (Vercel):** [https://neoz-ai-chatbot.vercel.app](https://neoz-ai-chatbot.vercel.app)
* **Core Node API (Render):** `Live`
* **Python Microservice (Docker/Render):** `Live`

---

## ⚡ Key Features

* **Cinematic Hacker UI:** A completely custom, dark-themed interface built with React & Tailwind CSS.
* **Lightning-Fast Streaming:** Real-time text generation powered by the Gemini Neural Engine with Server-Sent Events (SSE).
* **Hardware Protocol:** Native Web Serial API integration allows NEO-Z to communicate directly with connected hardware (e.g., Arduino/ESP32) via custom `<CMD>` tags.
* **Data & Vision Processing:** Upload images for visual analysis or attach CSV files for bulk data interpretation.
* **Dual-Brain Architecture:** 
  * Node.js handles real-time streams and database operations.
  * A Dockerized Python Microservice handles heavy audio/data processing (Voice module parked for future upgrades).
* **Accessibility & UX:** Fully narrated AI responses (Male/Female voice synthesis), one-click clipboard copying, and strict Lighthouse accessibility standards.

---

## 🛠️ Technology Stack

**Frontend:**
* React (Vite)
* Tailwind CSS
* React Markdown & remark-gfm (For rich text rendering)
* Web Speech API (Narrator) & Web Serial API (Hardware)

**Core Backend:**
* Node.js & Express
* MongoDB (Data Persistence)
* Google Generative AI (Gemini Flash)

**Python Microservice:**
* FastAPI
* Docker (Containerized Environment)
* SpeechRecognition & Pydub (Audio handling)

---

## ⚙️ Local Development Setup

### Prerequisites
* Node.js (v18+)
* Python 3.13+
* Docker (optional, for local microservice testing)
* MongoDB URI
* Gemini API Key

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/QaziZaid16/neoz-ai-chatbot.git
cd neoz-ai-chatbot
\`\`\`

### 2. Setup Core Backend
\`\`\`bash
cd backend
npm install
# Create a .env file with PORT, MONGODB_URI, and GEMINI_API_KEY
npm run dev
\`\`\`

### 3. Setup Frontend
\`\`\`bash
cd frontend
npm install
# Update API_BASE_URL in App.jsx to point to localhost if testing locally
npm run dev
\`\`\`

### 4. Setup Python Microservice
\`\`\`bash
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload
\`\`\`

---

## 🤝 Author
Built and designed by **Qazi Zaid**.
