/* eslint-disable vitest/expect-expect */
import { readFileSync } from "fs";
import { join } from "path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DEFAULT_CATEGORY } from "../../types";
import type { Prompt } from "../../types";
import { StorageManager } from "../storage";

const FIXED_TIME = new Date("2025-01-01T00:00:00Z");

describe("StorageManager - Import Validation", () => {
  let storageManager: StorageManager;

  // Helper to check validation errors
  const expectValidationError = async (
    importData: string,
    expectedErrorPattern: string | RegExp,
  ) => {
    try {
      await storageManager.importData(importData);
      expect.fail("Should have thrown validation error");
    } catch (error) {
      const err = error as Error & { details?: { errors?: string[] } };
      expect(err.message).toContain("validation");

      // Check if any error in the details matches the pattern
      const errors = err.details?.errors || [];
      const pattern =
        typeof expectedErrorPattern === "string"
          ? new RegExp(
              expectedErrorPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i",
            )
          : expectedErrorPattern;

      const hasMatch = errors.some((e) => pattern.test(e));
      if (!hasMatch) {
        throw new Error(
          `Expected error matching ${expectedErrorPattern}, but got errors: ${errors.join("; ")}`,
        );
      }
    }
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    storageManager = StorageManager.getInstance();

    // Initialize with default data
    await chrome.storage.local.set({
      prompts: [],
      categories: [{ id: "default", name: DEFAULT_CATEGORY }],
      settings: {
        defaultCategory: DEFAULT_CATEGORY,
        sortOrder: "updatedAt",
        sortDirection: "desc",
        theme: "light",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Valid Data", () => {
    it("should accept valid import data with all required fields", async () => {
      const validData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test Prompt",
            content: "Test content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [
          {
            id: "cat-1",
            name: DEFAULT_CATEGORY,
          },
        ],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(validData)).resolves.not.toThrow();

      const result = await chrome.storage.local.get(["prompts"]);
      const prompts = result.prompts as Prompt[];
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        id: "prompt-1",
        title: "Test Prompt",
        content: "Test content",
      });
    });

    it("should accept valid data with optional fields", async () => {
      const validData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test Prompt",
            content: "Test content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
            usageCount: 5,
            lastUsedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [
          {
            id: "cat-1",
            name: DEFAULT_CATEGORY,
            color: "#FF0000",
          },
        ],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
          interfaceMode: "popup",
        },
      });

      await expect(storageManager.importData(validData)).resolves.not.toThrow();
    });

    it("should accept legacy data without optional fields (backwards compatibility)", async () => {
      const legacyData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Legacy Prompt",
            content: "No usageCount or lastUsedAt",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
            // Missing optional fields: usageCount, lastUsedAt
          },
        ],
        categories: [
          {
            id: "cat-1",
            name: DEFAULT_CATEGORY,
            // Missing optional field: color
          },
        ],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
          // Missing optional field: interfaceMode
        },
      });

      await expect(
        storageManager.importData(legacyData),
      ).resolves.not.toThrow();
    });
  });

  describe("Structure Validation", () => {
    it("should reject null data", async () => {
      await expect(storageManager.importData("null")).rejects.toThrow(
        "Import data must be a valid JSON object",
      );
    });

    it("should reject non-object data", async () => {
      await expect(storageManager.importData('"string"')).rejects.toThrow(
        "Import data must be a valid JSON object",
      );
      await expect(storageManager.importData("123")).rejects.toThrow(
        "Import data must be a valid JSON object",
      );
      await expect(storageManager.importData("true")).rejects.toThrow(
        "Import data must be a valid JSON object",
      );
    });

    it("should reject data missing prompts field", async () => {
      const invalidData = JSON.stringify({
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /Invalid import data structure.*Missing required field: prompts/,
      );
    });

    it("should reject data missing categories field", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /Invalid import data structure.*Missing required field: categories/,
      );
    });

    it("should reject data missing settings field", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /Invalid import data structure.*Missing required field: settings/,
      );
    });

    it("should reject data where prompts is not an array", async () => {
      const invalidData = JSON.stringify({
        prompts: { notAnArray: true },
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /prompts.*must be an array/,
      );
    });

    it("should reject data where categories is not an array", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: "not-an-array",
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /categories.*must be an array/,
      );
    });

    it("should reject data where settings is not an object", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: null,
      });

      await expect(storageManager.importData(invalidData)).rejects.toThrow(
        /settings.*must be an object/,
      );
    });
  });

  describe("Prompt Validation", () => {
    it("should reject prompt missing id field", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, 'Missing required field "id"');
    });

    it("should reject prompt with empty id", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, '"id" cannot be empty');
    });

    it("should reject prompt with non-string id", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: 123,
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, '"id" must be a string');
    });

    it("should reject prompt missing title", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'Missing required field "title"',
      );
    });

    it("should reject prompt with title exceeding 100 characters", async () => {
      const longTitle = "A".repeat(101);
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: longTitle,
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        "exceeds maximum length of 100 characters",
      );
    });

    it("should reject prompt missing content", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'Missing required field "content"',
      );
    });

    it("should reject prompt with content exceeding 20000 characters", async () => {
      const longContent = "X".repeat(20001);
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: longContent,
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        "exceeds maximum length of 20,000 characters",
      );
    });

    it("should reject prompt with negative createdAt", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: -1000,
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'createdAt" must be a positive number',
      );
    });

    it("should reject prompt with updatedAt before createdAt", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime() - 10000,
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'updatedAt" cannot be before "createdAt"',
      );
    });

    it("should reject prompt with negative usageCount", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
            usageCount: -5,
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'usageCount" cannot be negative',
      );
    });

    it("should reject prompt with non-integer usageCount", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
            usageCount: 5.5,
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'usageCount" must be an integer',
      );
    });

    it("should reject prompt with lastUsedAt before createdAt", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
            lastUsedAt: FIXED_TIME.getTime() - 10000,
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'lastUsedAt" cannot be before "createdAt"',
      );
    });
  });

  describe("Category Validation", () => {
    it("should reject category missing id", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, 'Missing required field "id"');
    });

    it("should reject category missing name", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1" }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, 'Missing required field "name"');
    });

    it("should reject category with name exceeding 50 characters", async () => {
      const longName = "C".repeat(51);
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: longName }],
        settings: {
          defaultCategory: longName,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        "exceeds maximum length of 50 characters",
      );
    });

    it("should reject category with invalid color format", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY, color: "red" }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, "must be a valid hex color");
    });

    it("should accept category with valid hex color", async () => {
      const validData = JSON.stringify({
        prompts: [],
        categories: [
          { id: "cat-1", name: DEFAULT_CATEGORY, color: "#FF0000" },
          { id: "cat-2", name: "Another", color: "#00ff00" },
        ],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expect(storageManager.importData(validData)).resolves.not.toThrow();
    });
  });

  describe("Settings Validation", () => {
    it("should reject settings missing defaultCategory", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'Missing required field "defaultCategory"',
      );
    });

    it("should reject settings missing sortOrder", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        'Missing required field "sortOrder"',
      );
    });

    it("should reject settings with invalid sortOrder", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "invalidOrder",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, "Must be one of");
    });

    it("should reject settings with invalid sortDirection", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "sideways",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, "Must be one of");
    });

    it("should reject settings with invalid theme", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "rainbow",
        },
      });

      await expectValidationError(invalidData, "Must be one of");
    });

    it("should reject settings with invalid interfaceMode", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
          interfaceMode: "holographic",
        },
      });

      await expectValidationError(invalidData, "Must be one of");
    });

    it("should accept all valid sortOrder values", async () => {
      const validOrders = [
        "createdAt",
        "updatedAt",
        "title",
        "usageCount",
        "lastUsedAt",
      ];

      for (const sortOrder of validOrders) {
        const validData = JSON.stringify({
          prompts: [],
          categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
          settings: {
            defaultCategory: DEFAULT_CATEGORY,
            sortOrder,
            sortDirection: "desc",
            theme: "light",
          },
        });

        await expect(
          storageManager.importData(validData),
        ).resolves.not.toThrow();
      }
    });
  });

  describe("Duplicate Detection", () => {
    it("should reject data with duplicate prompt IDs", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "duplicate-id",
            title: "First",
            content: "First content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
          {
            id: "duplicate-id",
            title: "Second",
            content: "Second content",
            category: DEFAULT_CATEGORY,
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, "Duplicate prompt IDs");
    });

    it("should reject data with duplicate category names (case-insensitive)", async () => {
      const invalidData = JSON.stringify({
        prompts: [],
        categories: [
          { id: "cat-1", name: "Test" },
          { id: "cat-2", name: "test" },
          { id: "cat-3", name: "TEST" },
        ],
        settings: {
          defaultCategory: "Test",
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(invalidData, "Duplicate category names");
    });
  });

  describe("Referential Integrity", () => {
    it("should reject data where prompts reference non-existent categories", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test",
            content: "Content",
            category: "NonExistentCategory",
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        "Referential integrity violation",
      );
    });

    it("should report multiple referential integrity violations", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "prompt-1",
            title: "Test 1",
            content: "Content 1",
            category: "Missing1",
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
          {
            id: "prompt-2",
            title: "Test 2",
            content: "Content 2",
            category: "Missing2",
            createdAt: FIXED_TIME.getTime(),
            updatedAt: FIXED_TIME.getTime(),
          },
        ],
        categories: [{ id: "cat-1", name: DEFAULT_CATEGORY }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "updatedAt",
          sortDirection: "desc",
          theme: "light",
        },
      });

      await expectValidationError(
        invalidData,
        "Referential integrity violation",
      );
    });
  });

  describe("Multiple Errors", () => {
    it("should collect and report all validation errors", async () => {
      const invalidData = JSON.stringify({
        prompts: [
          {
            id: "",
            title: "A".repeat(101),
            content: "",
            category: "MissingCategory",
            createdAt: -1000,
            updatedAt: FIXED_TIME.getTime(),
            usageCount: -5,
          },
        ],
        categories: [{ id: "", name: "" }],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: "invalid",
          sortDirection: "invalid",
          theme: "invalid",
        },
      });

      try {
        await storageManager.importData(invalidData);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        const err = error as Error & { details?: { errors?: string[] } };
        expect(err.message).toContain("Import validation failed");
        expect(err.details?.errors).toBeDefined();
        expect(err.details?.errors?.length).toBeGreaterThan(5);
      }
    });
  });

  describe("Corrupted Sample Files", () => {
    const samplesDir = join(__dirname, "../../../corrupted-data-samples");

    it("should reject missing-fields.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "missing-fields.json"),
        "utf-8",
      );
      await expectValidationError(fileContent, "Missing required field");
    });

    it("should reject wrong-types.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "wrong-types.json"),
        "utf-8",
      );
      await expectValidationError(fileContent, "must be");
    });

    it("should reject duplicate-ids.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "duplicate-ids.json"),
        "utf-8",
      );
      await expectValidationError(fileContent, "Duplicate");
    });

    it("should reject broken-references.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "broken-references.json"),
        "utf-8",
      );
      await expectValidationError(
        fileContent,
        "Referential integrity violation",
      );
    });

    it("should reject invalid-timestamps.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "invalid-timestamps.json"),
        "utf-8",
      );
      await expectValidationError(
        fileContent,
        /(createdAt|updatedAt|usageCount|lastUsedAt)/,
      );
    });

    it("should reject invalid-settings.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "invalid-settings.json"),
        "utf-8",
      );
      await expectValidationError(fileContent, "Must be one of");
    });

    it("should reject length-violations.json", async () => {
      const fileContent = readFileSync(
        join(samplesDir, "length-violations.json"),
        "utf-8",
      );
      await expectValidationError(fileContent, "exceeds maximum length");
    });
  });
});
