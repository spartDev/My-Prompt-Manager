export const CLAUDE_MOCK_HTML = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 24px;
        background: #fafafa;
      }
      .chat-container {
        max-width: 800px;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        padding: 24px;
      }
      .input-container {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 24px;
        position: relative;
      }
      .ProseMirror {
        min-height: 120px;
        max-height: 300px;
        border: 2px solid #e1e5e9;
        border-radius: 8px;
        padding: 16px;
        flex: 1;
        outline: none;
        resize: none;
        font-size: 16px;
        line-height: 1.5;
      }
      .ProseMirror:focus {
        border-color: #c47566;
      }
      .send-button {
        background: #c47566;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 24px;
        cursor: pointer;
        font-weight: 500;
      }
      .send-button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .chat-history {
        margin-bottom: 24px;
      }
      .message {
        margin: 16px 0;
        padding: 16px;
        border-radius: 8px;
      }
      .user-message {
        background: #f0f9ff;
        border-left: 4px solid #0ea5e9;
      }
      .assistant-message {
        background: #f8fafc;
        border-left: 4px solid #64748b;
      }
    </style>
  </head>
  <body>
    <div class="chat-container">
      <h1>Claude</h1>
      <div class="chat-history" id="chat-history">
        <div class="message assistant-message">
          Hello! I'm Claude, an AI assistant. How can I help you today?
        </div>
      </div>

      <div class="input-container">
        <div class="ProseMirror"
             contenteditable="true"
             role="textbox"
             aria-label="Message Claude"
             data-placeholder="Message Claude...">
        </div>
        <button class="send-button" disabled>Send</button>
      </div>
    </div>

    <script>
      // Enhanced mock behavior for Claude interface with better content script support
      const editor = document.querySelector('.ProseMirror');
      const sendButton = document.querySelector('.send-button');
      const chatHistory = document.getElementById('chat-history');

      // Store original execCommand to prevent interference
      const originalExecCommand = document.execCommand;

      // Add global debugging
      window.debugInsertions = [];
      window.eventListenerDebug = [];

      // Intercept addEventListener to track what events are being attached
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (this.classList && this.classList.contains('prompt-item') && type === 'click') {
          console.log('[MOCK] Event listener added to prompt-item:', {
            type,
            element: this.className,
            promptId: this.dataset?.promptId
          });
          window.eventListenerDebug.push({
            type,
            element: this.className,
            promptId: this.dataset?.promptId,
            timestamp: Date.now()
          });
        }
        return originalAddEventListener.call(this, type, listener, options);
      };

      // Override execCommand to handle insertText properly for content script
      document.execCommand = function(command, ui, value) {
        console.log('[MOCK] execCommand called:', { command, ui, value });
        window.debugInsertions.push({ method: 'execCommand', command, value, timestamp: Date.now() });

        if (command === 'insertText' && value) {
          // Find all ProseMirror elements that could be targets
          const proseMirrorElements = document.querySelectorAll('.ProseMirror[contenteditable="true"]');
          console.log('[MOCK] Found ProseMirror elements:', proseMirrorElements.length);

          // Check if any ProseMirror element is focused or has selection
          for (const element of proseMirrorElements) {
            const rect = element.getBoundingClientRect();
            console.log('[MOCK] Checking element:', { rect, visible: rect.width > 0 && rect.height > 0 });
            if (rect.width > 0 && rect.height > 0) { // Element is visible
              console.log('[MOCK] Inserting text into ProseMirror:', value);
              // Replace content in the ProseMirror element
              element.textContent = value;

              // Trigger comprehensive events for the content script
              const events = [
                new InputEvent('input', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'insertText',
                  data: value
                }),
                new Event('change', { bubbles: true }),
                new Event('compositionend', { bubbles: true })
              ];

              events.forEach(event => {
                console.log('[MOCK] Dispatching event:', event.type);
                element.dispatchEvent(event);
              });

              // Also trigger on document for any global listeners
              document.dispatchEvent(new CustomEvent('prosemirror-content-changed', {
                detail: { element, content: value }
              }));

              console.log('[MOCK] Text insertion completed successfully');
              return true;
            }
          }
        }
        return originalExecCommand.call(this, command, ui, value);
      };

      // Make editor focusable and handle focus events
      editor.tabIndex = 0;

      // Add click handler to simulate focus behavior
      editor.addEventListener('click', () => {
        editor.focus();
      });

      // Add focus handler to ensure element is properly focused
      editor.addEventListener('focus', () => {
        // Simulate selection behavior that content script expects
        if (window.getSelection) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });

      editor.addEventListener('input', () => {
        const hasContent = editor.textContent.trim().length > 0;
        sendButton.disabled = !hasContent;
      });

      // Handle programmatic text changes (for DOM manipulation method)
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const hasContent = editor.textContent.trim().length > 0;
            sendButton.disabled = !hasContent;
            console.log('[MOCK] Content changed via mutation:', editor.textContent);
          }
        });
      });
      observer.observe(editor, { childList: true, subtree: true, characterData: true });

      // Intercept direct textContent changes
      const originalDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(editor, 'textContent', {
        set: function(value) {
          console.log('[MOCK] Direct textContent change:', value);
          window.debugInsertions.push({ method: 'textContent', value, timestamp: Date.now() });
          originalDescriptor.set.call(this, value);
        },
        get: function() {
          return originalDescriptor.get.call(this);
        },
        configurable: true,
        enumerable: true
      });

      sendButton.addEventListener('click', () => {
        const content = editor.textContent.trim();
        if (content) {
          // Add user message
          const userMessage = document.createElement('div');
          userMessage.className = 'message user-message';
          userMessage.textContent = content;
          chatHistory.appendChild(userMessage);

          // Add mock assistant response
          setTimeout(() => {
            const assistantMessage = document.createElement('div');
            assistantMessage.className = 'message assistant-message';
            assistantMessage.textContent = 'Thank you for your message: "' + content + '". This is a mock response for testing.';
            chatHistory.appendChild(assistantMessage);
          }, 1000);

          // Clear input
          editor.textContent = '';
          sendButton.disabled = true;
        }
      });
    </script>
  </body>
</html>
`;

export const CHATGPT_MOCK_HTML = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ChatGPT</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 0;
        margin: 0;
        background: #343541;
        color: white;
      }
      .chat-container {
        max-width: 768px;
        margin: 0 auto;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .chat-area {
        flex: 1;
        padding: 24px;
      }
      .input-area {
        padding: 24px;
        background: #40414f;
        border-top: 1px solid #565869;
      }
      .input-container {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        position: relative;
        background: #40414f;
        border: 1px solid #565869;
        border-radius: 8px;
        padding: 12px;
      }
      textarea {
        flex: 1;
        min-height: 24px;
        max-height: 200px;
        border: none;
        background: transparent;
        color: white;
        outline: none;
        resize: none;
        font-size: 16px;
        line-height: 1.5;
        font-family: inherit;
      }
      textarea::placeholder {
        color: #8e8ea0;
      }
      .send-button {
        background: #19c37d;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 500;
        min-width: 60px;
      }
      .send-button:disabled {
        background: #565869;
        cursor: not-allowed;
      }
      .message {
        margin: 16px 0;
        padding: 16px;
        border-radius: 8px;
      }
      .user-message {
        background: #444654;
        margin-left: 48px;
      }
      .assistant-message {
        background: #343541;
        border: 1px solid #565869;
      }
    </style>
  </head>
  <body>
    <div class="chat-container">
      <header style="padding: 16px 24px; border-bottom: 1px solid #565869;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">ChatGPT</h1>
      </header>
      <div class="chat-area" id="chat-area">
        <div class="message assistant-message">
          Hello! I'm ChatGPT, an AI assistant. How can I assist you today?
        </div>
      </div>

      <div class="input-area">
        <div class="input-container">
          <textarea
            placeholder="Send a message..."
            id="prompt-textarea"
            rows="1"></textarea>
          <button class="send-button" disabled id="send-button">Send</button>
        </div>
      </div>
    </div>

    <script>
      // Simple mock behavior for ChatGPT interface
      const textarea = document.getElementById('prompt-textarea');
      const sendButton = document.getElementById('send-button');
      const chatArea = document.getElementById('chat-area');

      textarea.addEventListener('input', () => {
        const hasContent = textarea.value.trim().length > 0;
        sendButton.disabled = !hasContent;

        // Auto-resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
      });

      sendButton.addEventListener('click', () => {
        const content = textarea.value.trim();
        if (content) {
          // Add user message
          const userMessage = document.createElement('div');
          userMessage.className = 'message user-message';
          userMessage.textContent = content;
          chatArea.appendChild(userMessage);

          // Add mock assistant response
          setTimeout(() => {
            const assistantMessage = document.createElement('div');
            assistantMessage.className = 'message assistant-message';
            assistantMessage.textContent = 'Thank you for your message: "' + content + '". This is a mock ChatGPT response for testing.';
            chatArea.appendChild(assistantMessage);
          }, 1500);

          // Clear input
          textarea.value = '';
          textarea.style.height = 'auto';
          sendButton.disabled = true;
        }
      });
    </script>
  </body>
</html>
`;
