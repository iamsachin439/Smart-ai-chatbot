/**
 * Smart AI Chatbot - Markdown & Code Highlighting Engine
 * Uses Marked.js, Highlight.js, and DOMPurify for fast, secure formatting
 */

const MarkdownRenderer = (() => {
  // Configure marked options if marked is loaded
  if (typeof marked !== 'undefined') {
    const renderer = new marked.Renderer();

    // Custom code block renderer with language badge and Copy button
    renderer.code = function ({ text, lang, escaped }) {
      const language = (lang || '').trim().toLowerCase();
      let highlightedCode = '';

      if (typeof hljs !== 'undefined') {
        if (language && hljs.getLanguage(language)) {
          try {
            highlightedCode = hljs.highlight(text, { language, ignoreIllegals: true }).value;
          } catch (e) {
            highlightedCode = escapeHtml(text);
          }
        } else {
          try {
            highlightedCode = hljs.highlightAuto(text).value;
          } catch (e) {
            highlightedCode = escapeHtml(text);
          }
        }
      } else {
        highlightedCode = escapeHtml(text);
      }

      const displayLang = language || 'code';

      return `
        <div class="code-block-container">
          <div class="code-header">
            <span class="code-lang">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              ${escapeHtml(displayLang)}
            </span>
            <button class="code-copy-btn" type="button" onclick="MarkdownRenderer.copyCode(this)" title="Copy code">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code class="hljs language-${escapeHtml(displayLang)}">${highlightedCode}</code></pre>
        </div>
      `;
    };

    // Custom link renderer: open external links safely in new tab
    renderer.link = function ({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    };

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
      pedantic: false
    });
  }

  /**
   * Escape raw HTML entities
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Render raw markdown text to sanitized HTML
   */
  function render(content) {
    if (!content) return '';

    try {
      let rawHtml = '';
      if (typeof marked !== 'undefined') {
        rawHtml = marked.parse(content);
      } else {
        // Fallback simple line break renderer if marked is unavailable
        rawHtml = escapeHtml(content).replace(/\n/g, '<br>');
      }

      // Sanitize using DOMPurify
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml, {
          ADD_TAGS: ['svg', 'path', 'line', 'polyline', 'rect', 'circle'],
          ADD_ATTR: ['target', 'rel', 'onclick', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'd']
        });
      }

      return rawHtml;
    } catch (err) {
      console.error('Markdown rendering error:', err);
      return escapeHtml(content).replace(/\n/g, '<br>');
    }
  }

  /**
   * Copy code block contents to clipboard with button feedback
   */
  function copyCode(btn) {
    const container = btn.closest('.code-block-container');
    if (!container) return;

    const codeEl = container.querySelector('code');
    if (!codeEl) return;

    const codeText = codeEl.innerText || codeEl.textContent;

    navigator.clipboard.writeText(codeText).then(() => {
      const originalHTML = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code:', err);
    });
  }

  return {
    render,
    copyCode,
    escapeHtml
  };
})();

// Expose globally for inline onclick handlers
window.MarkdownRenderer = MarkdownRenderer;
