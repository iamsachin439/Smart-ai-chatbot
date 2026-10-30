# 🤖 Smart AI Chatbot

A modern, responsive, conversational AI assistant web application inspired by ChatGPT. Built with Node.js, Express, vanilla HTML5, CSS3, and JavaScript, with OpenAI API integration (GPT-4o, GPT-4o mini, GPT-3.5 Turbo), real-time Server-Sent Events (SSE) streaming, syntax-highlighted code blocks, bilingual support (English & हिन्दी), voice recognition (Speech-to-Text), and audio playback (Text-to-Speech).

![Smart AI Chatbot](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-blue?style=for-the-badge&logo=openai)
![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)

---

## ✨ Key Features

### 🎨 1. ChatGPT-Inspired User Interface
- **Modern Clean Layout:** Authentic ChatGPT look and feel with dark and light theme options.
- **Collapsible Drawer Sidebar:** Seamless responsive sidebar with backdrop overlay on mobile and tablet screens.
- **Welcome Screen:** Engaging prompt suggestion cards covering coding, concept explanation, Hindi poetry, and business brainstorming.
- **Typing Animation:** Smooth three-dot bounce indicator while the AI generates responses.
- **Auto-Resizing Input:** Textarea expands dynamically up to 200px as you type multiline prompts.
- **Keyboard Shortcuts:**
  - `Enter` – Send message.
  - `Shift + Enter` – Insert a new line.
  - `Ctrl + K` or `Cmd + K` – Create a new chat.
  - `Escape` – Close modal dialogs and dropdown menus.

### 🧠 2. Intelligent AI Capabilities & Bilingual Support
- **OpenAI Streaming (SSE):** Real-time token streaming with stop-generation support.
- **Model Switching:** Easily switch between `GPT-4o mini` (fast), `GPT-4o` (deep reasoning), and `GPT-3.5 Turbo`.
- **Bilingual Engine (English & हिन्दी):** Complete native support for both English and Hindi. Toggle automatically or pin your preferred language with one click.
- **Conversation Context:** Multi-turn memory sent with each request for intelligent follow-ups.
- **Graceful Fallback Mode:** Works out-of-the-box even before adding an OpenAI API key with a simulated bilingual streaming engine.

### 💻 3. Code Highlighting & Markdown Rendering
- **Full Markdown Support:** Headings, blockquotes, lists, tables, and formatted links rendered securely using [Marked.js](https://marked.js.org/) and sanitized with [DOMPurify](https://github.com/cure53/DOMPurify).
- **Syntax Highlighting:** Powered by [Highlight.js](https://highlightjs.org/) with automated language detection.
- **One-Click Code Copy:** Dedicated header bar on every code block displaying language badges and copy button with visual feedback.

### 🎙️ 4. Voice Input & Speech Synthesis
- **Speech-to-Text:** Dictate prompts using the microphone button powered by the Web Speech API (`webkitSpeechRecognition`).
- **Read Aloud (TTS):** Click the "Speak" button on any response to have the AI read answers aloud, automatically selecting native Hindi or English voices.

### 💾 5. History Management & Export
- **Smart Grouping:** History grouped chronologically into *Today*, *Yesterday*, *Previous 7 Days*, and *Older*.
- **Search Conversations:** Instant client-side search across past conversation titles and contents.
- **Rename & Delete:** Edit conversation titles or delete individual chats directly from the sidebar.
- **Export to Markdown:** Download conversations as formatted `.md` files complete with timestamps.
- **Dual Persistence:** Stored instantly in browser `localStorage` and synchronized with the backend (`data/conversations.json`).

---

## 📁 Project Structure

```
chat bot/
├── package.json              # Project dependencies and npm scripts
├── package-lock.json         # Locked dependency tree
├── server.js                 # Express server & OpenAI SSE streaming controller
├── .env                      # Local environment variables (Port, API Keys)
├── .env.example              # Template for environment configuration
├── data/
│   └── conversations.json    # Persistent server-side conversation store
├── public/                   # Static frontend assets served by Express
│   ├── index.html            # Main Single Page Application structure
│   ├── css/
│   │   ├── style.css         # Design system, layout, and UI components
│   │   ├── markdown.css      # Markdown typography and code block themes
│   │   └── responsive.css    # Mobile, tablet, and desktop breakpoints
│   └── js/
│       ├── markdownRenderer.js # Marked.js and Highlight.js configuration
│       ├── chatStorage.js      # LocalStorage & server sync manager
│       ├── ui.js               # DOM manipulation, theme, and modal controller
│       └── app.js              # Application logic, SSE reader, and speech API
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) installed (v18.0.0 or higher recommended).
- An [OpenAI API Key](https://platform.openai.com/api-keys) (optional – the app includes a fallback mode if you don't have one).

### 1. Clone or Open the Workspace
Open a terminal inside the project directory:
```bash
cd "c:\Pictures\OneDrive\Desktop\chat bot"
```

### 2. Install Dependencies
```bash
npm install
```

Dependencies installed:
- `express` – Web application server
- `cors` – Cross-origin resource sharing
- `dotenv` – Environment variable loader
- `openai` – Official OpenAI API client

### 3. Configure Your OpenAI API Key
You can configure your key in **either of two ways**:

#### Option A: In the `.env` file (Recommended for local dev)
Create or edit the `.env` file in the root folder:
```env
PORT=3000
OPENAI_API_KEY=sk-proj-yourActualOpenAiKeyHere...
DEFAULT_MODEL=gpt-4o-mini
```

#### Option B: Directly in the Web App Settings (No restart needed)
1. Launch the app.
2. Click the **Settings (⚙️)** button in the sidebar footer.
3. Paste your OpenAI API Key into the **OpenAI API Key** field.
4. Click **Save Changes**. Your key is stored securely in your browser session and sent directly to the server via authenticated headers.

### 4. Start the Application
For regular production start:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### 5. Open in Your Browser
Visit:
```
http://localhost:3000
```

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Returns server health, active model, and API key configuration status. |
| `POST` | `/api/chat` | Main SSE streaming completion endpoint. Accepts `{ messages, model, temperature, language }`. |
| `GET` | `/api/conversations` | Retrieves all saved conversations. |
| `POST` | `/api/conversations` | Creates or updates a conversation. |
| `DELETE` | `/api/conversations/:id` | Deletes a specific conversation by ID. |
| `DELETE` | `/api/conversations` | Clears all conversation history. |

---

## 🛡️ Security & Privacy
- **API Key Protection:** The server never exposes the backend `OPENAI_API_KEY` to the client.
- **XSS Prevention:** All AI responses and user inputs are passed through `DOMPurify` before rendering into the DOM.
- **Safe Fallback:** If no OpenAI key is configured, the server provides helpful bilingual simulated answers rather than failing or crashing.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

