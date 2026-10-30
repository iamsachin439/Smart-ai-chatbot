/**
 * Smart AI Chatbot - Data Storage & Settings Manager
 * Supports localStorage persistence with seamless backend synchronization
 */

const ChatStorage = (() => {
  const STORAGE_KEY_CONVOS = 'smart_ai_conversations';
  const STORAGE_KEY_SETTINGS = 'smart_ai_settings';
  const STORAGE_KEY_ACTIVE = 'smart_ai_active_id';

  // Default application settings
  const DEFAULT_SETTINGS = {
    apiKey: '',
    model: 'gpt-4o-mini',
    language: 'auto',
    temperature: 0.7,
    theme: 'dark'
  };

  /**
   * Generate UUID v4 identifier
   */
  function generateId() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  // --- Settings Management ---

  function getSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(settings) {
    try {
      const merged = { ...getSettings(), ...settings };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return getSettings();
    }
  }

  // --- Conversations Management ---

  function getAllConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONVOS);
      if (raw) {
        const convos = JSON.parse(raw);
        if (Array.isArray(convos)) return convos;
      }
    } catch (e) {
      console.warn('Could not parse conversations from localStorage:', e);
    }
    return [];
  }

  function getConversationById(id) {
    if (!id) return null;
    const all = getAllConversations();
    return all.find(c => c.id === id) || null;
  }

  function saveConversation(conversation) {
    if (!conversation || !conversation.id) return;
    const all = getAllConversations();
    const idx = all.findIndex(c => c.id === conversation.id);

    conversation.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      all[idx] = conversation;
    } else {
      if (!conversation.createdAt) conversation.createdAt = new Date().toISOString();
      all.unshift(conversation);
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONVOS, JSON.stringify(all));
    } catch (e) {
      console.error('Error saving conversation to localStorage:', e);
    }

    // Background sync with server
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation)
    }).catch(err => console.debug('Backend sync note:', err.message));

    return conversation;
  }

  function createNewConversation(title = 'New Chat') {
    const newConvo = {
      id: generateId(),
      title: title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    saveConversation(newConvo);
    setActiveConversationId(newConvo.id);
    return newConvo;
  }

  function deleteConversation(id) {
    if (!id) return;
    let all = getAllConversations();
    all = all.filter(c => c.id !== id);

    try {
      localStorage.setItem(STORAGE_KEY_CONVOS, JSON.stringify(all));
    } catch (e) {
      console.error('Error deleting from localStorage:', e);
    }

    if (getActiveConversationId() === id) {
      const nextId = all.length > 0 ? all[0].id : null;
      setActiveConversationId(nextId);
    }

    // Backend sync
    fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(err => console.debug('Backend delete note:', err.message));

    return all;
  }

  function clearAllConversations() {
    try {
      localStorage.removeItem(STORAGE_KEY_CONVOS);
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }

    // Backend sync
    fetch('/api/conversations', { method: 'DELETE' })
      .catch(err => console.debug('Backend clear note:', err.message));
  }

  function getActiveConversationId() {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  }

  function setActiveConversationId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  }

  /**
   * Sync initial data from backend if local storage is empty
   */
  async function syncInitialFromServer() {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const serverConvos = await res.json();
        if (Array.isArray(serverConvos) && serverConvos.length > 0) {
          const local = getAllConversations();
          if (local.length === 0) {
            localStorage.setItem(STORAGE_KEY_CONVOS, JSON.stringify(serverConvos));
            if (!getActiveConversationId()) {
              setActiveConversationId(serverConvos[0].id);
            }
          }
        }
      }
    } catch (e) {
      console.debug('Server conversations sync skipped or unavailable:', e.message);
    }
  }

  return {
    generateId,
    getSettings,
    saveSettings,
    getAllConversations,
    getConversationById,
    saveConversation,
    createNewConversation,
    deleteConversation,
    clearAllConversations,
    getActiveConversationId,
    setActiveConversationId,
    syncInitialFromServer
  };
})();

window.ChatStorage = ChatStorage;
