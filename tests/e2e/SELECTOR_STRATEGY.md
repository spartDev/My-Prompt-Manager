# Selector Strategy

## Priority Order

1. **Role-based selectors** (HIGHEST PRIORITY)
   - `page.getByRole('button', { name: 'Save' })`
   - Mirrors accessibility tree
   - Most resilient to UI changes

2. **Label-based selectors**
   - `page.getByLabel('Email')`
   - User-facing text
   - Good for forms

3. **Text-based selectors**
   - `page.getByText('Submit')`
   - `page.getByPlaceholder('Search...')`
   - Clear user intent

4. **Test IDs**
   - `page.getByTestId('submit-button')`
   - When multiple identical roles exist
   - Requires adding data-testid attributes

5. **CSS selectors** (LAST RESORT)
   - `page.locator('.submit-btn')`
   - Only when no semantic option exists
   - Document why it's necessary

## Adding Test IDs

When adding `data-testid` attributes:
- Use kebab-case: `data-testid="prompt-card"`
- Be descriptive: `data-testid="category-edit-button"`
- Add to reusable components first
- Document in component file

## Examples

See: tests/e2e/components/PromptCard.ts
