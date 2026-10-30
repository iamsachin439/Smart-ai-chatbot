/**
 * Smart AI Chatbot - Main Application Controller
 * Handles conversation flow, SSE streaming, voice dictation, and clean UX
 */

const App = (() => {
  let activeConversation = null;
  let abortController = null;
  let isGenerating = false;
  let speechRecognition = null;
  let isListening = false;

  /**
   * Application Initialization
   */
  async function init() {
    // 1. Sync backend conversations if available
    await ChatStorage.syncInitialFromServer();

    // 2. Load and apply user theme
    const settings = ChatStorage.getSettings();
    UI.applyTheme(settings.theme || 'dark');

    // 3. Load or create active conversation
    const allConvos = ChatStorage.getAllConversations();
    const lastActiveId = ChatStorage.getActiveConversationId();
    activeConversation = allConvos.find(c => c.id === lastActiveId) || allConvos[0] || null;

    if (!activeConversation) {
      activeConversation = ChatStorage.createNewConversation('New Chat');
    } else {
      ChatStorage.setActiveConversationId(activeConversation.id);
    }

    // 4. Render initial UI
    renderActiveConversation();
    UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation.id);

    // 5. Check server status in background
    checkServerStatus();

    // 6. Bind all UI event listeners
    bindEventListeners();
    setupSpeechRecognition();
  }

  /**
   * Check backend health and features
   */
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const settings = ChatStorage.getSettings();
        if (data.hasApiKey && !settings.apiKey) {
          UI.updateApiKeyBadge(true);
        }
      }
    } catch (e) {
      console.warn('Backend status note:', e.message);
    }
  }

  /**
   * Render the currently active conversation in the chat viewport
   */
  function renderActiveConversation() {
    if (!activeConversation) return;

    if (UI.elements.chatHeaderTitle) {
      UI.elements.chatHeaderTitle.textContent = activeConversation.title || 'Smart AI';
    }

    UI.renderMessages(activeConversation.messages || []);
    UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation.id);

    // Focus input on desktop
    if (window.innerWidth > 768 && UI.elements.chatTextarea) {
      UI.elements.chatTextarea.focus();
    }
  }

  /**
   * Auto-generate a descriptive title from the first prompt
   */
  function generateConversationTitle(prompt) {
    if (!prompt) return 'New Chat';
    const cleaned = prompt.replace(/[#*`_~]/g, '').trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 6) {
      return cleaned;
    }
    return words.slice(0, 6).join(' ') + '...';
  }

  /**
   * Send a user message and stream the AI response
   */
  async function sendMessage(userText) {
    const text = (userText || UI.elements.chatTextarea?.value || '').trim();
    if (!text || isGenerating) return;

    // Reset textarea input
    if (UI.elements.chatTextarea) {
      UI.elements.chatTextarea.value = '';
      UI.autoResizeTextarea();
    }

    if (!activeConversation) {
      activeConversation = ChatStorage.createNewConversation('New Chat');
    }

    // Auto-update conversation title on first message
    if (!activeConversation.messages || activeConversation.messages.length === 0) {
      activeConversation.title = generateConversationTitle(text);
      if (UI.elements.chatHeaderTitle) {
        UI.elements.chatHeaderTitle.textContent = activeConversation.title;
      }
    }

    // 1. Append User Message
    const userMsg = {
      id: ChatStorage.generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    activeConversation.messages.push(userMsg);
    ChatStorage.saveConversation(activeConversation);
    UI.appendUserMessage(text);
    UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation.id);

    // 2. Setup Assistant Streaming Placeholder
    isGenerating = true;
    UI.setGenerating(true);
    UI.setTyping(true);

    const assistantPlaceholder = UI.createStreamingAssistantPlaceholder();
    abortController = new AbortController();

    let accumulatedText = '';
    const settings = ChatStorage.getSettings();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (settings.apiKey && settings.apiKey.trim() !== '') {
        headers['x-api-key'] = settings.apiKey.trim();
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          messages: activeConversation.messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      UI.setTyping(false);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              accumulatedText += `\n\n⚠️ ${parsed.error}`;
              UI.updateStreamingBubble(assistantPlaceholder, accumulatedText);
            } else if (parsed.content) {
              accumulatedText += parsed.content;
              UI.updateStreamingBubble(assistantPlaceholder, accumulatedText);
            }
          } catch {
            // non-json line
          }
        }
      }

    } catch (err) {
      UI.setTyping(false);
      if (err.name === 'AbortError') {
        accumulatedText += '\n\n*(Generation stopped)*';
      } else {
        console.error('Chat request failed:', err);
        accumulatedText += `\n\n⚠️ ${err.message || 'Error connecting to service.'}`;
      }
      UI.updateStreamingBubble(assistantPlaceholder, accumulatedText);
    } finally {
      isGenerating = false;
      UI.setGenerating(false);
      UI.finalizeStreamingBubble(assistantPlaceholder);

      // Save assistant message to conversation
      if (accumulatedText.trim() !== '') {
        const assistantMsg = {
          id: ChatStorage.generateId(),
          role: 'assistant',
          content: accumulatedText,
          timestamp: new Date().toISOString()
        };
        activeConversation.messages.push(assistantMsg);
        ChatStorage.saveConversation(activeConversation);
        UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation.id);
      }
    }
  }

  /**
   * Regenerate the last AI response
   */
  function regenerateLastResponse() {
    if (isGenerating || !activeConversation || !activeConversation.messages.length) return;

    const msgs = activeConversation.messages;
    const lastMsg = msgs[msgs.length - 1];

    if (lastMsg.role === 'assistant') {
      msgs.pop();
    }

    const lastUserMsg = msgs[msgs.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      const prompt = lastUserMsg.content;
      msgs.pop();
      ChatStorage.saveConversation(activeConversation);
      renderActiveConversation();
      sendMessage(prompt);
    }
  }

  /**
   * Export conversation as Markdown file
   */
  function exportConversation() {
    if (!activeConversation || !activeConversation.messages.length) {
      UI.showToast('No messages to export.', 'info');
      return;
    }

    let md = `# ${activeConversation.title || 'Chat Conversation'}\n`;
    md += `*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;

    activeConversation.messages.forEach(m => {
      const roleName = m.role === 'user' ? '👤 User' : '🤖 Smart AI';
      md += `### ${roleName} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (activeConversation.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    UI.showToast('Conversation exported successfully!', 'success');
  }

  /**
   * Setup Web Speech API for voice dictation
   */
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (UI.elements.voiceBtn) {
        UI.elements.voiceBtn.title = 'Voice input not supported in this browser';
        UI.elements.voiceBtn.style.opacity = '0.5';
      }
      return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;

    speechRecognition.onstart = () => {
      isListening = true;
      UI.elements.voiceBtn?.classList.add('listening');
      UI.showToast('Listening... Speak now 🎙️', 'info', 2000);
    };

    speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (UI.elements.chatTextarea) {
        UI.elements.chatTextarea.value = transcript;
        UI.autoResizeTextarea();
      }
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech error:', event.error);
      isListening = false;
      UI.elements.voiceBtn?.classList.remove('listening');
    };

    speechRecognition.onend = () => {
      isListening = false;
      UI.elements.voiceBtn?.classList.remove('listening');
    };
  }

  function toggleVoiceInput() {
    if (!speechRecognition) {
      UI.showToast('Voice dictation not supported in this browser.', 'error');
      return;
    }

    if (isListening) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (e) {
        console.warn('Speech start note:', e);
      }
    }
  }

  /**
   * Bind DOM Event Listeners
   */
  function bindEventListeners() {
    const el = UI.elements;

    // 1. Textarea Auto-resize & Enter to Send
    el.chatTextarea?.addEventListener('input', () => {
      UI.autoResizeTextarea();
    });

    el.chatTextarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 2. Chat Form Submit
    el.chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    // 3. Stop Generation Button
    el.stopGenerationBtn?.addEventListener('click', () => {
      if (abortController) {
        abortController.abort();
      }
    });

    // 4. Voice Button
    el.voiceBtn?.addEventListener('click', () => {
      toggleVoiceInput();
    });

    // 5. Prompt Cards in Welcome Screen
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          sendMessage(prompt);
        }
      });
    });

    // 6. New Chat Button
    el.newChatBtn?.addEventListener('click', () => {
      activeConversation = ChatStorage.createNewConversation('New Chat');
      renderActiveConversation();
      UI.closeSidebar();
    });

    // 7. Search Conversations in Sidebar
    el.searchHistoryInput?.addEventListener('input', (e) => {
      UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation?.id, e.target.value);
    });

    // 8. Sidebar History Delegation (Select, Rename, Delete)
    el.historyList?.addEventListener('click', (e) => {
      const item = e.target.closest('.history-item');
      if (!item) return;

      const convoId = item.getAttribute('data-id');
      const actionBtn = e.target.closest('.action-btn');

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.getAttribute('data-action');

        if (action === 'delete') {
          ChatStorage.deleteConversation(convoId);
          const all = ChatStorage.getAllConversations();
          activeConversation = all.length > 0 ? all[0] : ChatStorage.createNewConversation('New Chat');
          renderActiveConversation();
          UI.showToast('Conversation deleted', 'info');
        } else if (action === 'rename') {
          const currentConvo = ChatStorage.getConversationById(convoId);
          const newTitle = prompt('Enter new conversation title:', currentConvo?.title || '');
          if (newTitle && newTitle.trim()) {
            currentConvo.title = newTitle.trim();
            ChatStorage.saveConversation(currentConvo);
            if (activeConversation.id === convoId) {
              activeConversation.title = newTitle.trim();
              if (el.chatHeaderTitle) el.chatHeaderTitle.textContent = newTitle.trim();
            }
            UI.renderHistoryList(ChatStorage.getAllConversations(), activeConversation.id);
            UI.showToast('Title updated', 'success');
          }
        }
        return;
      }

      // Switch Conversation
      if (convoId !== activeConversation?.id) {
        const selected = ChatStorage.getConversationById(convoId);
        if (selected) {
          activeConversation = selected;
          ChatStorage.setActiveConversationId(selected.id);
          renderActiveConversation();
          UI.closeSidebar();
        }
      }
    });

    // 9. Sidebar Toggles
    el.sidebarOpenBtn?.addEventListener('click', UI.toggleSidebar);
    el.sidebarCloseBtn?.addEventListener('click', UI.closeSidebar);
    el.sidebarBackdrop?.addEventListener('click', UI.closeSidebar);

    // 10. Theme Toggle
    el.themeToggleBtn?.addEventListener('click', UI.toggleTheme);

    // 11. Export & Clear Buttons
    el.exportChatBtn?.addEventListener('click', exportConversation);

    el.clearChatBtn?.addEventListener('click', () => {
      if (!activeConversation || !activeConversation.messages.length) return;
      if (confirm('Clear all messages in this chat?')) {
        activeConversation.messages = [];
        ChatStorage.saveConversation(activeConversation);
        renderActiveConversation();
        UI.showToast('Chat cleared');
      }
    });

    // 12. Settings Modal
    el.openSettingsBtn?.addEventListener('click', UI.openSettings);
    el.closeSettingsBtn?.addEventListener('click', UI.closeSettings);
    el.cancelSettingsBtn?.addEventListener('click', UI.closeSettings);

    el.toggleApiKeyVisBtn?.addEventListener('click', () => {
      if (el.apiKeyInput) {
        el.apiKeyInput.type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
      }
    });

    el.saveSettingsBtn?.addEventListener('click', () => {
      const apiKeyVal = el.apiKeyInput?.value.trim() || '';
      ChatStorage.saveSettings({ apiKey: apiKeyVal });
      UI.updateApiKeyBadge(Boolean(apiKeyVal));
      UI.closeSettings();
      UI.showToast('Settings saved', 'success');
    });

    el.clearAllHistoryBtn?.addEventListener('click', () => {
      if (confirm('Permanently delete all conversation history?')) {
        ChatStorage.clearAllConversations();
        activeConversation = ChatStorage.createNewConversation('New Chat');
        renderActiveConversation();
        UI.closeSettings();
        UI.showToast('All conversations cleared', 'info');
      }
    });

    // 13. Global Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        activeConversation = ChatStorage.createNewConversation('New Chat');
        renderActiveConversation();
        UI.closeSidebar();
      } else if (e.key === 'Escape') {
        UI.closeSettings();
        if (window.innerWidth <= 768) {
          UI.closeSidebar();
        }
      }
    });
  }

  return {
    init,
    sendMessage,
    regenerateLastResponse,
    exportConversation
  };
})();

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
