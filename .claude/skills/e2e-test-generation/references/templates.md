<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Templates — playwright-bdd artifacts

Fill-in skeletons for the four artifacts. Replace `Feature` / `feature` / `Name` placeholders. Always check existing files in `e2e/pages/` and `e2e/steps/` to reuse before creating new ones.

## 1. Feature file — `e2e/features/<feature>.feature`

```gherkin
Feature: <Capability in user terms>

  <Optional 1-3 line description of what the page/flow does and why,
  written for a reader who does not know the codebase.>

  Background:
    Given the user is on the <feature> page

  Scenario: <Single observable behavior>
    Then <expected outcome>
    And <additional assertion>

  Scenario: <Behavior triggered by an action>
    When the user selects the <thing> "<value>"
    Then <expected outcome>

  Scenario Outline: <Same flow over multiple inputs>
    When the user selects the <thing> "<value>"
    Then every displayed item has <thing> "<value>"

    Examples:
      | value   |
      | OPTION1 |
      | OPTION2 |
```

## 2. Page Object — `e2e/pages/<Name>Page.ts`

```ts
import { expect, type Locator } from '@playwright/test'
import { BasePage } from '@sanofi-accelerator/platform-e2e-utils'

export class <Name>Page extends BasePage {
  readonly path = '/<route>'

  get <thing>(): Locator {
    return this.page.getByTestId('<test-id>')
  }

  async select<Thing>(label: string): Promise<void> {
    // interactions: getByTestId / getByRole / getByPlaceholder — no CSS selectors
  }

  async expect<Thing>Visible(): Promise<void> {
    await expect(this.<thing>).toBeVisible()
  }

  async expectCountAtLeast(min: number): Promise<void> {
    // Poll async-loading lists; never assert on a snapshot count synchronously.
    await expect
      .poll(async () => this.<thing>.count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(min)
  }
}
```

`goto()` is inherited from `BasePage` and navigates to `path`.

## 3. Step definitions — `e2e/steps/<feature>.steps.ts`

```ts
import { Given, Then, When } from '../fixtures'

Given('the user is on the <feature> page', async ({ <name>Page }) => {
  await <name>Page.goto()
})

When(
  'the user selects the <thing> {string}',
  async ({ <name>Page }, value: string) => {
    await <name>Page.select<Thing>(value)
  },
)

Then('the <thing> is visible', async ({ <name>Page }) => {
  await <name>Page.expect<Thing>Visible()
})
```

Steps are thin: they only call Page Object methods. Keep all `expect(...)` assertions inside the Page Object.

## 4. Fixture wiring — `e2e/fixtures/index.ts`

A new Page Object does nothing until it is registered in **both** places:

```ts
import { <Name>Page } from '../pages/<Name>Page'

type Pages = {
  // ...existing pages
  <name>Page: <Name>Page
}

export const test = base.extend<Pages>({
  // ...existing fixtures
  <name>Page: async ({ page }, use) => {
    await use(new <Name>Page(page))
  },
})

export const { Given, When, Then, Step } = createBdd(test)
```
