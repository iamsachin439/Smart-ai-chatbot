/**
 * Smart AI Chatbot - UI Components & Interaction Controller
 * Handles styling, themes, modals, sidebar, history lists, and message bubbles
 */

const UI = (() => {
  // DOM References Cache
  const elements = {
    html: document.documentElement,
    appLayout: document.getElementById('appLayout'),
    sidebar: document.getElementById('sidebar'),
    sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    newChatBtn: document.getElementById('newChatBtn'),
    searchHistoryInput: document.getElementById('searchHistoryInput'),
    historyList: document.getElementById('historyList'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    hljsDarkTheme: document.getElementById('hljs-dark-theme'),
    hljsLightTheme: document.getElementById('hljs-light-theme'),
    chatHeaderTitle: document.getElementById('chatHeaderTitle'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    chatScrollArea: document.getElementById('chatScrollArea'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesContainer: document.getElementById('messagesContainer'),
    typingBubble: document.getElementById('typingBubble'),
    scrollAnchor: document.getElementById('scrollAnchor'),
    chatForm: document.getElementById('chatForm'),
    chatTextarea: document.getElementById('chatTextarea'),
    sendBtn: document.getElementById('sendBtn'),
    voiceBtn: document.getElementById('voiceBtn'),
    stopBtnWrap: document.getElementById('stopBtnWrap'),
    stopGenerationBtn: document.getElementById('stopGenerationBtn'),
    settingsModal: document.getElementById('settingsModal'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    apiKeyStatusBadge: document.getElementById('apiKeyStatusBadge'),
    toggleApiKeyVisBtn: document.getElementById('toggleApiKeyVisBtn'),
    clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // --- Themes ---

  function applyTheme(theme) {
    elements.html.setAttribute('data-theme', theme);

    if (elements.hljsDarkTheme && elements.hljsLightTheme) {
      if (theme === 'light') {
        elements.hljsDarkTheme.disabled = true;
        elements.hljsLightTheme.disabled = false;
      } else {
        elements.hljsDarkTheme.disabled = false;
        elements.hljsLightTheme.disabled = true;
      }
    }
  }

  function toggleTheme() {
    const current = elements.html.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    ChatStorage.saveSettings({ theme: nextTheme });
    showToast(`Switched to ${nextTheme} theme`);
    return nextTheme;
  }

  // --- Toasts ---

  function showToast(message, type = 'info', duration = 3000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  // --- Sidebar Mobile & Desktop ---

  function openSidebar() {
    elements.sidebar.classList.add('open');
    elements.sidebar.classList.remove('collapsed');
    elements.sidebarBackdrop.classList.add('active');
  }

  function closeSidebar() {
    elements.sidebar.classList.remove('open');
    if (window.innerWidth >= 769) {
      elements.sidebar.classList.add('collapsed');
    }
    elements.sidebarBackdrop.classList.remove('active');
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      if (elements.sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      elements.sidebar.classList.toggle('collapsed');
    }
  }

  // --- Sidebar Conversation History List ---

  function groupConversationsByDate(convos) {
    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: []
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfSevenDaysAgo = startOfToday - 86400000 * 7;

    convos.forEach(convo => {
      const time = new Date(convo.updatedAt || convo.createdAt).getTime();
      if (time >= startOfToday) {
        groups.Today.push(convo);
      } else if (time >= startOfYesterday) {
        groups.Yesterday.push(convo);
      } else if (time >= startOfSevenDaysAgo) {
        groups['Previous 7 Days'].push(convo);
      } else {
        groups.Older.push(convo);
      }
    });

    return groups;
  }

  function renderHistoryList(conversations, activeId, filterQuery = '') {
    if (!elements.historyList) return;

    let filtered = conversations;
    if (filterQuery && filterQuery.trim() !== '') {
      const q = filterQuery.toLowerCase().trim();
      filtered = conversations.filter(c =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.messages && c.messages.some(m => m.content && m.content.toLowerCase().includes(q)))
      );
    }

    if (filtered.length === 0) {
      elements.historyList.innerHTML = `
        <div class="history-empty-text">
          ${filterQuery ? 'No matching conversations' : 'No previous conversations yet.'}
        </div>
      `;
      return;
    }

    const grouped = groupConversationsByDate(filtered);
    let html = '';

    for (const [groupName, groupItems] of Object.entries(grouped)) {
      if (groupItems.length === 0) continue;

      html += `<div class="history-group">`;
      html += `<div class="history-group-title">${groupName}</div>`;

      groupItems.forEach(item => {
        const isActive = item.id === activeId ? 'active' : '';
        html += `
          <div class="history-item ${isActive}" data-id="${item.id}">
            <div class="history-item-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span class="history-item-title" title="${escapeHtml(item.title || 'Untitled Chat')}">${escapeHtml(item.title || 'Untitled Chat')}</span>
            <div class="history-item-actions">
              <button class="action-btn rename" data-action="rename" data-id="${item.id}" title="Rename conversation">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </button>
              <button class="action-btn delete" data-action="delete" data-id="${item.id}" title="Delete conversation">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    elements.historyList.innerHTML = html;
  }

  // --- Message Bubbles Rendering ---

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function renderMessages(messages) {
    if (!elements.messagesContainer) return;

    if (!messages || messages.length === 0) {
      if (elements.welcomeScreen) elements.welcomeScreen.style.display = 'flex';
      elements.messagesContainer.innerHTML = '';
      if (elements.chatHeaderTitle) elements.chatHeaderTitle.textContent = 'Smart AI';
      return;
    }

    if (elements.welcomeScreen) elements.welcomeScreen.style.display = 'none';

    let html = '';
    messages.forEach((msg, idx) => {
      const isUser = msg.role === 'user';
      const timeStr = formatTime(msg.timestamp);

      if (isUser) {
        html += `
          <div class="chat-message user" data-index="${idx}">
            <div class="msg-avatar user-avatar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="msg-content-wrapper">
              <div class="msg-header">
                <span class="msg-sender">You</span>
                <span class="msg-time">${timeStr}</span>
              </div>
              <div class="msg-bubble">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
            </div>
          </div>
        `;
      } else {
        const renderedBody = MarkdownRenderer.render(msg.content);
        html += `
          <div class="chat-message assistant" data-index="${idx}">
            <div class="msg-avatar ai-avatar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </div>
            <div class="msg-content-wrapper">
              <div class="msg-header">
                <span class="msg-sender">Smart AI</span>
                <span class="msg-time">${timeStr}</span>
              </div>
              <div class="msg-bubble">${renderedBody}</div>
              <div class="msg-actions">
                <button class="msg-act-btn" onclick="UI.copyMessageText(this)" title="Copy message">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  <span>Copy</span>
                </button>
                <button class="msg-act-btn" onclick="UI.speakMessageText(this)" title="Read aloud">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  <span>Speak</span>
                </button>
                <button class="msg-act-btn" onclick="UI.triggerRegenerate()" title="Regenerate response">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                  <span>Regenerate</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }
    });

    elements.messagesContainer.innerHTML = html;
    scrollToBottom(false);
  }

  function appendUserMessage(text) {
    if (elements.welcomeScreen) elements.welcomeScreen.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'chat-message user';
    div.innerHTML = `
      <div class="msg-avatar user-avatar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div class="msg-content-wrapper">
        <div class="msg-header">
          <span class="msg-sender">You</span>
          <span class="msg-time">${formatTime(new Date())}</span>
        </div>
        <div class="msg-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
      </div>
    `;

    elements.messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function createStreamingAssistantPlaceholder() {
    if (elements.welcomeScreen) elements.welcomeScreen.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'chat-message assistant streaming';
    div.innerHTML = `
      <div class="msg-avatar ai-avatar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
      </div>
      <div class="msg-content-wrapper">
        <div class="msg-header">
          <span class="msg-sender">Smart AI</span>
          <span class="msg-time">${formatTime(new Date())}</span>
        </div>
        <div class="msg-bubble"></div>
        <div class="msg-actions" style="display: none;">
          <button class="msg-act-btn" onclick="UI.copyMessageText(this)" title="Copy message">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          </button>
          <button class="msg-act-btn" onclick="UI.speakMessageText(this)" title="Read aloud">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            <span>Speak</span>
          </button>
          <button class="msg-act-btn" onclick="UI.triggerRegenerate()" title="Regenerate response">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            <span>Regenerate</span>
          </button>
        </div>
      </div>
    `;

    elements.messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  function updateStreamingBubble(element, markdownText) {
    if (!element) return;
    const bubble = element.querySelector('.msg-bubble');
    if (bubble) {
      bubble.innerHTML = MarkdownRenderer.render(markdownText);
      scrollToBottom();
    }
  }

  function finalizeStreamingBubble(element) {
    if (!element) return;
    element.classList.remove('streaming');
    const actions = element.querySelector('.msg-actions');
    if (actions) actions.style.display = 'flex';
  }

  // --- Scroll Helpers ---

  function scrollToBottom(smooth = true) {
    if (elements.chatScrollArea) {
      elements.chatScrollArea.scrollTo({
        top: elements.chatScrollArea.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // --- Typing Indicator & Stop Button ---

  function setTyping(isTyping) {
    if (elements.typingBubble) {
      elements.typingBubble.style.display = isTyping ? 'flex' : 'none';
      if (isTyping) scrollToBottom();
    }
  }

  function setGenerating(isGenerating) {
    if (elements.stopBtnWrap) {
      elements.stopBtnWrap.style.display = isGenerating ? 'block' : 'none';
    }
    if (elements.sendBtn) {
      elements.sendBtn.disabled = isGenerating || !elements.chatTextarea.value.trim();
    }
  }

  // --- Textarea Auto Resizing ---

  function autoResizeTextarea() {
    const tx = elements.chatTextarea;
    if (!tx) return;
    tx.style.height = 'auto';
    const newHeight = Math.min(tx.scrollHeight, 200);
    tx.style.height = (newHeight > 24 ? newHeight : 24) + 'px';

    if (elements.sendBtn) {
      elements.sendBtn.disabled = tx.value.trim() === '';
    }
  }

  // --- Audio / Text-To-Speech ---

  function speakMessageText(btn) {
    const msgWrapper = btn.closest('.chat-message');
    if (!msgWrapper) return;

    const bubble = msgWrapper.querySelector('.msg-bubble');
    if (!bubble) return;

    const textToSpeak = bubble.innerText || bubble.textContent;

    if (!('speechSynthesis' in window)) {
      showToast('Speech synthesis not supported on this browser', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'Speak';
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Auto-detect Hindi vs English voice
    const isHindi = /[\u0900-\u097F]/.test(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    if (isHindi) {
      const hiVoice = voices.find(v => v.lang.startsWith('hi'));
      if (hiVoice) utterance.voice = hiVoice;
      utterance.lang = 'hi-IN';
    } else {
      const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google')));
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = 'en-US';
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    btn.classList.add('active');
    btn.querySelector('span').textContent = 'Stop';

    utterance.onend = () => {
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'Speak';
    };

    utterance.onerror = () => {
      btn.classList.remove('active');
      btn.querySelector('span').textContent = 'Speak';
    };

    window.speechSynthesis.speak(utterance);
  }

  function copyMessageText(btn) {
    const msgWrapper = btn.closest('.chat-message');
    if (!msgWrapper) return;
    const bubble = msgWrapper.querySelector('.msg-bubble');
    if (!bubble) return;

    const text = bubble.innerText || bubble.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const span = btn.querySelector('span');
      const oldText = span.textContent;
      span.textContent = 'Copied!';
      setTimeout(() => { span.textContent = oldText; }, 2000);
    });
  }

  function triggerRegenerate() {
    if (window.App && typeof window.App.regenerateLastResponse === 'function') {
      window.App.regenerateLastResponse();
    }
  }

  // --- Settings Modal ---

  function openSettings() {
    const settings = ChatStorage.getSettings();
    if (elements.apiKeyInput) elements.apiKeyInput.value = settings.apiKey || '';
    updateApiKeyBadge(Boolean(settings.apiKey));
    if (elements.settingsModal) elements.settingsModal.style.display = 'flex';
  }

  function closeSettings() {
    if (elements.settingsModal) elements.settingsModal.style.display = 'none';
  }

  function updateApiKeyBadge(isSaved) {
    if (!elements.apiKeyStatusBadge) return;
    if (isSaved) {
      elements.apiKeyStatusBadge.textContent = 'Configured';
      elements.apiKeyStatusBadge.classList.add('saved');
    } else {
      elements.apiKeyStatusBadge.textContent = 'Optional';
      elements.apiKeyStatusBadge.classList.remove('saved');
    }
  }

  function escapeHtml(str) {
    return MarkdownRenderer.escapeHtml(str);
  }

  return {
    elements,
    applyTheme,
    toggleTheme,
    showToast,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    renderHistoryList,
    renderMessages,
    appendUserMessage,
    createStreamingAssistantPlaceholder,
    updateStreamingBubble,
    finalizeStreamingBubble,
    scrollToBottom,
    setTyping,
    setGenerating,
    autoResizeTextarea,
    speakMessageText,
    copyMessageText,
    triggerRegenerate,
    openSettings,
    closeSettings,
    updateApiKeyBadge
  };
})();

window.UI = UI;
