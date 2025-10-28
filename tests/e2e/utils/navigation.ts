/**
 * Navigation utilities for E2E tests
 *
 * This module provides navigation helpers for moving between different
 * contexts and pages in the Chrome extension testing environment.
 */

import type { Page, BrowserContext } from '@playwright/test';

import { expect } from '../fixtures/extension';
import { CLAUDE_MOCK_HTML, CHATGPT_MOCK_HTML } from '../fixtures/mock-pages';

/**
 * Extension page navigation utilities
 */
export const extensionNavigation = {
  /**
   * Open the extension sidepanel
   */
  openSidepanel: async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });
    return page;
  },

  /**
   * Open the extension popup
   */
  openPopup: async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    return page;
  },

  /**
   * Switch between extension views
   */
  switchToView: async (page: Page, extensionId: string, view: 'popup' | 'sidepanel'): Promise<void> => {
    const url = `chrome-extension://${extensionId}/${view}.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  },
};

/**
 * Mock site navigation and setup utilities
 */
export const mockSiteNavigation = {
  /**
   * Set up Claude.ai mock routing
   */
  setupClaudeMock: async (context: BrowserContext): Promise<void> => {
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
  },

  /**
   * Set up ChatGPT mock routing
   */
  setupChatGPTMock: async (context: BrowserContext): Promise<void> => {
    await context.route('https://chat.openai.com/**', async (route) => {
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
  },

  /**
   * Navigate to Claude.ai with mock
   */
  navigateToClaudeMock: async (page: Page): Promise<void> => {
    await page.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });
    // Wait for mock to be fully loaded and interactive
    await expect(page.locator('.ProseMirror')).toBeVisible();
  },

  /**
   * Navigate to ChatGPT with mock
   */
  navigateToChatGPTMock: async (page: Page): Promise<void> => {
    await page.goto('https://chat.openai.com/', { waitUntil: 'domcontentloaded' });
    // Wait for mock to be fully loaded
    await expect(page.locator('#prompt-textarea')).toBeVisible();
  },

  /**
   * Set up all platform mocks
   */
  setupAllPlatformMocks: async (context: BrowserContext): Promise<void> => {
    await mockSiteNavigation.setupClaudeMock(context);
    await mockSiteNavigation.setupChatGPTMock(context);
  },
};

/**
 * Content script testing navigation
 */
export const contentScriptNavigation = {
  /**
   * Open a new page with platform mock and test content script injection
   */
  openWithContentScript: async (
    context: BrowserContext,
    platform: 'claude' | 'chatgpt'
  ): Promise<Page> => {
    const page = await context.newPage();

    // Set up appropriate mock
    if (platform === 'claude') {
      await mockSiteNavigation.setupClaudeMock(context);
      await mockSiteNavigation.navigateToClaudeMock(page);
    } else {
      await mockSiteNavigation.setupChatGPTMock(context);
      await mockSiteNavigation.navigateToChatGPTMock(page);
    }

    return page;
  },

  /**
   * Switch between extension and content script contexts
   */
  switchToExtensionContext: async (
    context: BrowserContext,
    extensionId: string,
    view: 'popup' | 'sidepanel' = 'sidepanel'
  ): Promise<Page> => {
    if (view === 'popup') {
      return extensionNavigation.openPopup(context, extensionId);
    }
    return extensionNavigation.openSidepanel(context, extensionId);
  },

  /**
   * Test content script on multiple platforms
   */
  testOnAllPlatforms: async (
    context: BrowserContext,
    testFn: (page: Page, platform: string) => Promise<void>
  ): Promise<void> => {
    const platforms = ['claude', 'chatgpt'] as const;

    for (const platform of platforms) {
      const page = await contentScriptNavigation.openWithContentScript(context, platform);
      try {
        await testFn(page, platform);
      } finally {
        await page.close();
      }
    }
  },
};

/**
 * Settings and configuration navigation
 */
export const settingsNavigation = {
  /**
   * Navigate to settings from any page
   */
  openSettings: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  },

  /**
   * Navigate back to library from settings
   */
  backToLibrary: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Library' }).click();
    await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  },

  /**
   * Navigate to specific settings section
   */
  openSettingsSection: async (page: Page, section: string): Promise<void> => {
    await settingsNavigation.openSettings(page);
    // If there are tabs/sections, click the appropriate one
    const sectionTab = page.getByRole('tab', { name: section });
    if (await sectionTab.isVisible()) {
      await sectionTab.click();
    }
  },
};

/**
 * Modal and dialog navigation
 */
export const modalNavigation = {
  /**
   * Open category manager modal
   */
  openCategoryManager: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Manage categories' }).click();
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
  },

  /**
   * Close any modal using the standard close button
   */
  closeModal: async (page: Page): Promise<void> => {
    const closeButton = page.locator('button').filter({
      has: page.locator('path[d="M6 18L18 6M6 6l12 12"]')
    }).first();
    await closeButton.click();
  },

  /**
   * Open prompt form (create mode)
   */
  openPromptForm: async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Add new prompt' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();
  },

  /**
   * Open prompt edit form
   */
  openPromptEditForm: async (page: Page, promptTitle: string): Promise<void> => {
    const promptCard = page.locator('article').filter({ hasText: promptTitle }).first();
    await promptCard.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
  },
};

/**
 * Testing workflow navigation helpers
 */
export const testingNavigation = {
  /**
   * Navigate through a complete user flow
   */
  completeUserFlow: async (
    context: BrowserContext,
    extensionId: string,
    flow: (page: Page) => Promise<void>
  ): Promise<void> => {
    const page = await extensionNavigation.openSidepanel(context, extensionId);
    try {
      await flow(page);
    } finally {
      await page.close();
    }
  },

  /**
   * Test across multiple interface modes
   */
  testAcrossInterfaceModes: async (
    context: BrowserContext,
    extensionId: string,
    testFn: (page: Page, mode: string) => Promise<void>
  ): Promise<void> => {
    const modes = ['sidepanel', 'popup'] as const;

    for (const mode of modes) {
      const page = mode === 'sidepanel'
        ? await extensionNavigation.openSidepanel(context, extensionId)
        : await extensionNavigation.openPopup(context, extensionId);

      try {
        await testFn(page, mode);
      } finally {
        await page.close();
      }
    }
  },

  /**
   * Set up a complex testing scenario
   */
  setupTestingScenario: async (
    context: BrowserContext,
    extensionId: string,
    scenario: {
      interfaceMode?: 'popup' | 'sidepanel';
      mockPlatforms?: boolean;
      openSettings?: boolean;
    } = {}
  ): Promise<Page> => {
    const page = scenario.interfaceMode === 'popup'
      ? await extensionNavigation.openPopup(context, extensionId)
      : await extensionNavigation.openSidepanel(context, extensionId);

    if (scenario.mockPlatforms) {
      await mockSiteNavigation.setupAllPlatformMocks(context);
    }

    if (scenario.openSettings) {
      await settingsNavigation.openSettings(page);
    }

    return page;
  },
};

/**
 * All navigation utilities combined
 */
export const navigation = {
  extension: extensionNavigation,
  mockSites: mockSiteNavigation,
  contentScript: contentScriptNavigation,
  settings: settingsNavigation,
  modals: modalNavigation,
  testing: testingNavigation,
};
