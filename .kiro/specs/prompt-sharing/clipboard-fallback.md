# Clipboard Strategy

## Overview

This document specifies the clipboard integration for prompt sharing. Since we target modern browsers (Chrome 66+, Firefox 63+, Safari 13.1+), we use the Clipboard API exclusively.

## Implementation Strategy

**Simple and Direct**: Use Clipboard API, show error toast if it fails.

**Rationale**:
- All modern browsers support Clipboard API (since 2018-2020)
- Clipboard failures are rare in practice (requires HTTPS, user gesture)
- Adding fallback UI adds complexity for an edge case
- Users understand clipboard failures and can retry

## Implementation Specification

```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    Logger.error('Clipboard API failed', toError(err), {
      component: 'PromptCard',
      error: toError(err).message
    });
    return false;
  }
}
```

## Share Handler Implementation

```typescript
async function handleShare(prompt: Prompt): Promise<void> {
  setIsSharing(true);

  try {
    const encoded = await PromptEncoder.encode(prompt);
    const success = await copyToClipboard(encoded);

    if (success) {
      toast.success('Sharing code copied to clipboard!');
    } else {
      toast.error('Failed to copy to clipboard. Please try again.');
    }
  } catch (err) {
    Logger.error('Failed to encode prompt', toError(err), {
      component: 'PromptCard',
      operation: 'share',
      promptId: prompt.id
    });
    toast.error('Failed to generate sharing code');
  } finally {
    setIsSharing(false);
  }
}
```

## User Experience Flow

```
1. User clicks share button
2. Encoding starts (show loading state on button)
3. Try Clipboard API
   ✓ Success → Show success toast
   ✗ Fail → Show error toast, user can retry
```

## User Messages

### Toast Notifications

**Success**:
```
"Sharing code copied to clipboard!"
```

**Clipboard Failed**:
```
"Failed to copy to clipboard. Please try again."
```

**Encoding Failed**:
```
"Failed to generate sharing code. Please try again."
```

## Accessibility Requirements

1. **Button States**
   - Loading state during encoding
   - Disabled while processing
   - Clear focus indicator

2. **Screen Readers**
   - Button label: "Share this prompt"
   - Announce success: "Sharing code copied to clipboard"
   - Announce errors via toast announcements

3. **ARIA Attributes**
   ```tsx
   <button
     aria-label="Share this prompt"
     aria-busy={isSharing}
     disabled={isSharing}
   >
     <ShareIcon />
   </button>
   ```

## Testing Strategy

### Unit Tests

```typescript
describe('Clipboard Copy', () => {
  it('should copy to clipboard successfully', async () => {
    const success = await copyToClipboard('test-code');
    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-code');
  });

  it('should return false when Clipboard API fails', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('NotAllowedError')
    );

    const success = await copyToClipboard('test-code');
    expect(success).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Share Button Flow', () => {
  it('should copy to clipboard and show success toast', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    render(<PromptCard prompt={mockPrompt} />);
    await userEvent.click(screen.getByLabelText('Share this prompt'));

    expect(writeTextSpy).toHaveBeenCalled();
    expect(screen.getByText('Sharing code copied to clipboard!')).toBeInTheDocument();
  });

  it('should show error toast when clipboard fails', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error());

    render(<PromptCard prompt={mockPrompt} />);
    await userEvent.click(screen.getByLabelText('Share this prompt'));

    expect(screen.getByText('Failed to copy to clipboard. Please try again.')).toBeInTheDocument();
  });

  it('should disable button while sharing', async () => {
    render(<PromptCard prompt={mockPrompt} />);
    const button = screen.getByLabelText('Share this prompt');

    userEvent.click(button);

    // Button should be disabled during encoding
    expect(button).toBeDisabled();
  });
});
```

## Browser Compatibility

All modern browsers support Clipboard API:

| Browser | Clipboard API Support |
|---------|----------------------|
| Chrome | ✓ 66+ (April 2018) |
| Firefox | ✓ 63+ (October 2018) |
| Safari | ✓ 13.1+ (March 2020) |
| Edge | ✓ 79+ (January 2020) |
| Mobile Safari | ✓ 13.4+ (March 2020) |
| Chrome Mobile | ✓ 66+ (April 2018) |

**Notes**:
- Clipboard API requires HTTPS (localhost is exempt)
- Requires user gesture (click/tap)
- Manual copy modal works on all browsers as universal fallback
