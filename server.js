import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CONVERSATIONS_FILE)) {
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify([]), 'utf-8');
}

function loadConversations() {
  try {
    const raw = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading conversations file:', err);
    return [];
  }
}

function saveConversations(convos) {
  try {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(convos, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing conversations file:', err);
  }
}

// Locate local agy.exe
const AGY_PATH = process.env.ANTIGRAVITY_AGENTAPI_EXE || 'C:\\Users\\kumar\\.gemini\\bin\\agy.exe';
const HAS_AGY = fs.existsSync(AGY_PATH);

app.get('/api/status', (req, res) => {
  const hasEnvKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '' && !process.env.OPENAI_API_KEY.includes('your_openai_api_key_here'));
  res.json({
    status: 'online',
    appName: 'Smart AI Chatbot',
    hasApiKey: hasEnvKey || HAS_AGY,
    features: ['streaming', 'context_memory', 'multilingual_en_hi', 'markdown', 'code_highlighting']
  });
});

app.get('/api/conversations', (req, res) => {
  res.json(loadConversations());
});

app.post('/api/conversations', (req, res) => {
  const newConvo = req.body;
  if (!newConvo || !newConvo.id) {
    return res.status(400).json({ error: 'Conversation id is required' });
  }
  const convos = loadConversations();
  const existingIdx = convos.findIndex((c) => c.id === newConvo.id);
  if (existingIdx >= 0) {
    convos[existingIdx] = newConvo;
  } else {
    convos.unshift(newConvo);
  }
  saveConversations(convos);
  res.json({ success: true, conversation: newConvo });
});

app.delete('/api/conversations/:id', (req, res) => {
  const { id } = req.params;
  const convos = loadConversations();
  const filtered = convos.filter((c) => c.id !== id);
  saveConversations(filtered);
  res.json({ success: true });
});

app.delete('/api/conversations', (req, res) => {
  saveConversations([]);
  res.json({ success: true, message: 'All conversations cleared' });
});

/**
 * Fast factual knowledge retriever (Wikipedia Hindi & English)
 */
async function fetchFactualGroundTruth(query) {
  const clean = query.replace(/[?.,!]/g, '').trim();
  const isHindi = /[\u0900-\u097F]/.test(clean) || /\b(kisne|kya|kaun|kab|kaha|kaise|likha|likhi)\b/i.test(clean);

  const searchPhrase = clean
    .replace(/\b(kisne|likha|likhi|hai|h|kaun|kya|kab|kaha|who|wrote|written|by|author|of|about|is|the)\b/gi, '')
    .trim();

  const searchTerms = [searchPhrase, clean].filter(t => t && t.length >= 2);

  for (const term of searchTerms) {
    for (const lang of (isHindi ? ['hi', 'en'] : ['en', 'hi'])) {
      try {
        const opensearchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=3&format=json`;
        const res = await fetch(opensearchUrl, { signal: AbortSignal.timeout(1200) });
        const data = await res.json();
        if (data[1] && data[1].length > 0) {
          for (const title of data[1]) {
            const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
            const sumRes = await fetch(sumUrl, { signal: AbortSignal.timeout(1200) });
            const sumData = await sumRes.json();
            if (sumData.extract && sumData.extract.length > 25) {
              return {
                title: sumData.title,
                extract: sumData.extract,
                lang
              };
            }
          }
        }
      } catch {
        // continue
      }
    }
  }
  return null;
}

// Fallback streamer
async function streamFactualFallback(lastUserMsg, res) {
  const groundTruth = await fetchFactualGroundTruth(lastUserMsg);
  let reply = '';

  if (groundTruth && groundTruth.extract) {
    reply = groundTruth.extract;
  } else {
    const isHindi = /[\u0900-\u097F]/.test(lastUserMsg) || /\b(namaste|kaise|aap|tum|kya)\b/i.test(lastUserMsg);
    reply = isHindi
      ? `आपके प्रश्न: **"${lastUserMsg}"** का उत्तर:\n\nकृपया प्रश्न को थोड़ा और स्पष्ट करें ताकि सटीक जानकारी दी जा सके।`
      : `Regarding: **"${lastUserMsg}"**:\n\nPlease specify additional details so I can provide the exact answer.`;
  }

  const words = reply.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    await new Promise((r) => setTimeout(r, 20));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// Main Chat Completion Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  // Set SSE response headers for real-time streaming
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sanitizedMessages = messages
    .filter((m) => m && m.role && m.content)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).trim()
    }));

  const lastUserMsg = sanitizedMessages[sanitizedMessages.length - 1]?.content || '';
  const customKey = req.headers['x-api-key'];
  const apiKey = (customKey && customKey.trim()) || process.env.OPENAI_API_KEY;
  const hasRealKey = Boolean(apiKey && apiKey.trim().startsWith('sk-') && !apiKey.includes('your_openai_api_key_here'));

  // Option 1: Live OpenAI API if user supplied an API key
  if (hasRealKey) {
    try {
      const openai = new OpenAI({ apiKey: apiKey.trim() });
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a direct, concise, and highly accurate AI assistant.
Answer ONLY the specific question requested by the user.
Directly explain the concept, solve the problem, or provide the exact answer clearly and accurately.
DO NOT include unsolicited advice, generic pro-tips, disclaimers, or promotional notes.
If in Hindi, reply in clear, natural Hindi (हिन्दी). If in English, reply in English.
Start directly with the answer.`
          },
          ...sanitizedMessages
        ],
        temperature: 0.6,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err) {
      console.error('OpenAI API Error, falling back to local engine:', err.message);
    }
  }

  // Option 2: Local AI engine (agy.exe) for 100% accurate, real answers
  if (HAS_AGY) {
    try {
      // Build clean prompt: for follow-ups include previous turns
      let promptText = lastUserMsg;
      if (sanitizedMessages.length > 1) {
        const historyContext = sanitizedMessages
          .slice(-4, -1)
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        promptText = `${historyContext}\nUser: ${lastUserMsg}`;
      }

      const child = spawn(AGY_PATH, [
        '--dangerously-skip-permissions',
        '--disable-slash-commands',
        '-p',
        promptText
      ]);

      let hasOutput = false;

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf-8');
        console.log('[AGY STDOUT length]:', text.length);
        if (text) {
          hasOutput = true;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      });

      child.stderr.on('data', (errChunk) => {
        console.error('[AGY STDERR]:', errChunk.toString('utf-8'));
      });

      child.on('close', (code) => {
        console.log('[AGY CLOSE]:', code, 'hasOutput:', hasOutput);
        if (hasOutput) {
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          // If no output, fall back to factual ground truth
          streamFactualFallback(lastUserMsg, res);
        }
      });

      child.on('error', (err) => {
        console.error('AGY execution error:', err.message);
        streamFactualFallback(lastUserMsg, res);
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          try {
            child.kill();
          } catch {}
        }
      });

      return;
    } catch (err) {
      console.error('Error starting local AI engine:', err.message);
    }
  }

  // Option 3: Factual ground truth fallback
  await streamFactualFallback(lastUserMsg, res);
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🤖 Smart AI Chatbot Server is running on port ${PORT}`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`🧠 AI Engine: ${HAS_AGY ? 'Local AI Active ✅' : 'OpenAI / Web Active'}`);
  console.log(`===============================================`);
});
