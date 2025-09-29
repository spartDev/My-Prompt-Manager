import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

// Mock Claude.ai HTML structure
const CLAUDE_MOCK_HTML = /* html */ `
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

// Mock ChatGPT HTML structure
const CHATGPT_MOCK_HTML = /* html */ `
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

test.describe('User Journey: New User Setup & First Prompt Creation', () => {
  test('should complete the complete new user onboarding workflow', async ({
    context,
    storage,
    extensionId
  }) => {
    // Start with completely fresh state (no data)
    await seedLibrary(storage, {
      prompts: [],
      categories: [],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
    });

    // Step 1: User opens extension for the first time
    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });

    // Verify fresh state - should see empty state
    await expect(sidepanelPage.getByText('You\'re ready to go')).toBeVisible();
    await expect(sidepanelPage.getByText('Create your first prompt to start building')).toBeVisible();

    // Step 2: User creates their first custom category
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

    // Should see default category only
    await expect(sidepanelPage.getByText('1 category')).toBeVisible();
    await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();

    // Create first custom category: "Work"
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Work');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();

    // Verify category created
    await expect(sidepanelPage.getByText('Category created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('2 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Work')).toBeVisible();

    // Create second category: "Personal"
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Personal');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();

    await expect(sidepanelPage.getByText('Category created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('3 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Personal')).toBeVisible();

    // Return to main library view (close category manager)
    const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton.click();

    // Step 3: User creates their first prompt in a custom category
    // Verify we're back in library view
    await expect(sidepanelPage.getByText('My Prompt Manager')).toBeVisible();
    await sidepanelPage.getByRole('button', { name: /Add/ }).click();

    // Fill in prompt details
    await sidepanelPage.getByLabel('Title (optional)').fill('Email Summary Template');
    await sidepanelPage.getByLabel('Content *').fill('Please summarize the key points from this email and suggest appropriate actions:\n\n[EMAIL_CONTENT]');

    // Select "Work" category
    await sidepanelPage.getByLabel('Category').selectOption('Work');

    // Save the prompt
    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    // Verify prompt created successfully
    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();

    // Step 4: Create another prompt in different category
    await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();

    await sidepanelPage.getByLabel('Title (optional)').fill('Creative Writing Starter');
    await sidepanelPage.getByLabel('Content *').fill('Help me start a creative writing piece about [TOPIC]. Provide an engaging opening paragraph and suggest the tone and style.');
    await sidepanelPage.getByLabel('Category').selectOption('Personal');

    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

    // Step 5: Test category filtering
    // Filter by Work category
    await sidepanelPage.locator('select').filter({ hasText: 'All Categories' }).selectOption('Work');

    // Should only see work-related prompt
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).not.toBeVisible();

    // Filter by Personal category
    await sidepanelPage.locator('select').filter({ hasText: 'Work' }).selectOption('Personal');

    // Should only see personal prompt
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();
    await expect(sidepanelPage.getByText('Email Summary Template')).not.toBeVisible();

    // Reset to show all
    await sidepanelPage.locator('select').filter({ hasText: 'Personal' }).selectOption('');
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

    // Step 6: Test prompt usage on Claude.ai (mocked)
    // Set up Claude.ai mocking
    await context.route('https://claude.ai/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: CLAUDE_MOCK_HTML,
        });
      } else {
        await route.continue();
      }
    });

    // Open Claude.ai in new tab
    const claudePage = await context.newPage();

    // Set up console logging BEFORE navigating to capture all content script output
    const consoleLogs = [];
    claudePage.on('console', msg => {
      // Capture ALL console messages to debug why setupPromptSelectorEvents isn't called
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await claudePage.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });

    // Wait for the page to load completely
    await expect(claudePage.getByRole('heading', { name: 'Claude' })).toBeVisible();
    await expect(claudePage.locator('.ProseMirror')).toBeVisible();

    // Extension should inject the prompt library icon
    await expect(claudePage.locator('.prompt-library-integrated-icon')).toBeVisible();

    // Click the prompt library icon
    await claudePage.locator('.prompt-library-integrated-icon').click();

    // Should see prompt selector with our created prompts
    await expect(claudePage.getByText('Email Summary Template')).toBeVisible();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeVisible();

    // Test search functionality in content script (no category filter)
    const searchInput = claudePage.locator('.search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Email');
    await expect(claudePage.getByText('Email Summary Template')).toBeVisible();
    await expect(claudePage.getByText('Creative Writing Starter')).not.toBeVisible();

    // Clear search to see all prompts again
    await searchInput.clear();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeVisible();

    // Debug: Check prompt selector state before clicking
    const beforeClickDebug = await claudePage.evaluate(() => {
      const promptItems = document.querySelectorAll('.prompt-item');
      const items = Array.from(promptItems).map(item => ({
        text: item.textContent?.trim(),
        hasDataset: !!item.dataset.promptId,
        promptId: item.dataset.promptId,
        classList: item.className
      }));
      return {
        promptItemsFound: promptItems.length,
        items,
        selectorVisible: !!document.querySelector('.prompt-library-selector')
      };
    });
    console.log('[TEST] Before click debug:', beforeClickDebug);

    // Add click event debugging
    await claudePage.evaluate(() => {
      window.clickDebug = [];
      // Add global click listener to track ALL clicks, not just prompt-item ones
      document.addEventListener('click', (e) => {
        const target = e.target;
        const promptItem = target.closest('.prompt-item');

        window.clickDebug.push({
          targetTag: target.tagName,
          targetClassName: target.className,
          targetId: target.id,
          targetText: target.textContent?.substring(0, 50) || '',
          hasPromptItem: !!promptItem,
          promptId: promptItem?.dataset?.promptId,
          timestamp: Date.now(),
          eventPhase: e.eventPhase,
          bubbles: e.bubbles,
          cancelable: e.cancelable,
          defaultPrevented: e.defaultPrevented
        });
      }, true); // Use capture phase to catch everything
    });

    // Select the email template prompt - use data-prompt-id attribute instead of text filtering
    // to avoid triggering search functionality that recreates DOM elements
    const promptItems = await claudePage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.prompt-item'));
      return items.map(item => ({
        promptId: item.dataset.promptId,
        text: item.textContent?.substring(0, 50)
      }));
    });
    console.log('[TEST] Available prompt items:', promptItems);

    // Find the email template prompt by text content and click by prompt ID
    const emailPromptId = promptItems.find(item => item.text?.includes('Email Summary Template'))?.promptId;
    if (!emailPromptId) {
      throw new Error('Email Summary Template prompt not found');
    }

    await claudePage.locator(`[data-prompt-id="${emailPromptId}"]`).click();

    // Wait a moment for insertion to complete and check debug info
    await claudePage.waitForTimeout(1000);

    // Check debug information
    const debugInfo = await claudePage.evaluate(() => {
      return {
        insertions: window.debugInsertions || [],
        clickEvents: window.clickDebug || [],
        eventListeners: window.eventListenerDebug || [],
        proseMirrorContent: document.querySelector('.ProseMirror')?.textContent || 'NOT_FOUND',
        proseMirrorHTML: document.querySelector('.ProseMirror')?.innerHTML || 'NOT_FOUND',
        selectorStillVisible: !!document.querySelector('.prompt-library-selector')
      };
    });
    console.log('[TEST] Debug info:', debugInfo);
    console.log('[TEST] Content script console logs:', consoleLogs);

    // Verify prompt is inserted into the editor
    const editor = claudePage.locator('.ProseMirror');
    await expect(editor).toContainText('Please summarize the key points from this email');

    // Verify prompt selector closes after insertion
    await expect(claudePage.getByText('Email Summary Template')).not.toBeVisible();

    // Step 7: Test on ChatGPT (mocked) with different prompt
    await context.route('https://chatgpt.com/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: CHATGPT_MOCK_HTML,
        });
      } else {
        await route.continue();
      }
    });

    const chatgptPage = await context.newPage();
    await chatgptPage.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });

    await expect(chatgptPage.getByRole('heading', { name: 'ChatGPT' })).toBeVisible();
    await expect(chatgptPage.locator('#prompt-textarea')).toBeVisible();

    // Extension should inject prompt library icon
    await expect(chatgptPage.locator('.prompt-library-integrated-icon')).toBeVisible();

    // Open prompt selector
    await chatgptPage.locator('.prompt-library-integrated-icon').click();

    // Test search functionality to find creative writing prompt
    const chatgptSearchInput = chatgptPage.locator('.search-input');
    await chatgptSearchInput.fill('Creative');
    await expect(chatgptPage.getByText('Creative Writing Starter')).toBeVisible();
    await expect(chatgptPage.getByText('Email Summary Template')).not.toBeVisible();

    // Clear search to make selection
    await chatgptSearchInput.clear();
    await expect(chatgptPage.getByText('Email Summary Template')).toBeVisible();

    await chatgptPage.locator('.prompt-item').filter({ hasText: 'Creative Writing Starter' }).click();

    // Verify prompt inserted into ChatGPT textarea
    const textarea = chatgptPage.locator('#prompt-textarea');
    await expect(textarea).toHaveValue(/Help me start a creative writing piece about/);

    // Step 8: Return to extension and verify data persistence
    await sidepanelPage.bringToFront();

    // Verify all data is still there
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

    // Check categories are still available
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
    await expect(sidepanelPage.getByText('3 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Work')).toBeVisible();
    await expect(sidepanelPage.getByText('Personal')).toBeVisible();
    await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();

    // Close category manager
    const closeButton2 = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton2.click();

    // Step 9: Add one more prompt to verify iterative building
    // (Category manager already closed, so we're back in library view)
    await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();

    await sidepanelPage.getByLabel('Title (optional)').fill('Code Review Helper');
    await sidepanelPage.getByLabel('Content *').fill('Please review this code for:\n1. Best practices\n2. Potential bugs\n3. Performance improvements\n4. Security issues\n\nCode:\n[CODE_TO_REVIEW]');
    await sidepanelPage.getByLabel('Category').selectOption('Work');

    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Code Review Helper')).toBeVisible();

    // Final verification: User now has a functional prompt library
    // - 3 categories (including default)
    // - 3 prompts across 2 custom categories
    // - Tested cross-platform integration
    // - Verified data persistence and filtering

    await expect(sidepanelPage.locator('article')).toHaveCount(3);

    // Verify category distribution
    await sidepanelPage.locator('select').filter({ hasText: 'All Categories' }).selectOption('Work');
    await expect(sidepanelPage.locator('article')).toHaveCount(2); // Email + Code Review

    await sidepanelPage.locator('select').filter({ hasText: 'Work' }).selectOption('Personal');
    await expect(sidepanelPage.locator('article')).toHaveCount(1); // Creative Writing
  });

  test('should handle new user workflow with search functionality', async ({
    context,
    storage,
    extensionId
  }) => {
    // Start fresh
    await seedLibrary(storage, {
      prompts: [],
      categories: [],
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);

    // Create a category and multiple prompts
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Development');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();
    // Close category manager
    const closeButton3 = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton3.click();

    // Add multiple prompts with different keywords
    const prompts = [
      { title: 'JavaScript Debug Helper', content: 'Help me debug this JavaScript code' },
      { title: 'Python Code Review', content: 'Review this Python function for improvements' },
      { title: 'API Documentation', content: 'Create documentation for this API endpoint' }
    ];

    for (const prompt of prompts) {
      await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();
      await sidepanelPage.getByLabel('Title (optional)').fill(prompt.title);
      await sidepanelPage.getByLabel('Content *').fill(prompt.content);
      await sidepanelPage.getByLabel('Category').selectOption('Development');
      await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();
      await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    }

    // Test search functionality
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('JavaScript');
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).toBeVisible();
    await expect(sidepanelPage.getByText('Python Code Review')).not.toBeVisible();
    await expect(sidepanelPage.getByText('API Documentation')).not.toBeVisible();

    // Search by title
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('Python');
    await expect(sidepanelPage.getByText('Python Code Review')).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).not.toBeVisible();

    // Search by content
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('documentation');
    await expect(sidepanelPage.getByText('API Documentation')).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).not.toBeVisible();

    // Clear search to show all
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('');
    await expect(sidepanelPage.locator('article')).toHaveCount(3);
  });
});