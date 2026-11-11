import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRESET_COLORS } from '../../constants/colors';
import { formatCharacterCount } from '../../constants/validation';
import { PROMPT_LIMITS } from '../../services/promptAdmission';
import * as promptEncoder from '../../services/promptEncoder';
import { MOTION } from '../../theme/motion';
import type { Category, Prompt } from '../../types';
import PromptEditor from '../PromptEditor';

const categories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: PRESET_COLORS[0].value },
  { id: 'personal', name: 'Personal', color: '#00ff00' }
];

const prompt: Prompt = {
  id: 'p1',
  title: 'Meeting Notes',
  content: 'Body',
  category: 'Work',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000
};

type Props = React.ComponentProps<typeof PromptEditor>;

const renderEditor = (props: Partial<Props> = {}) => {
  const all: Props = {
    categories: [...categories],
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onCreateCategory: vi.fn((data: { name: string; color: string }) =>
      Promise.resolve({ id: 'new', name: data.name.trim(), color: data.color })),
    ...props
  };
  return { ...render(<PromptEditor {...all} />), props: all };
};

const renderEdit = (props: Partial<Props> = {}) => renderEditor({ prompt, onDelete: vi.fn(), ...props });

const title = () => screen.getByLabelText('Title');
const content = () => screen.getByLabelText('Content');
const save = () => screen.getByRole('button', { name: /^(save|import)$/i });
const categoryGroup = () => screen.getByRole('radiogroup', { name: 'Category' });
const chip = (name: string) => within(categoryGroup()).getByRole('radio', { name });

describe('PromptEditor - header', () => {
  it('shows Cancel, "New prompt" and Save for a new Prompt', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'New prompt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(save()).toHaveTextContent('Save');
  });

  it('shows "Edit prompt" with the Prompt in the fields when editing', () => {
    renderEdit();

    expect(screen.getByRole('heading', { name: 'Edit prompt' })).toBeInTheDocument();
    expect(title()).toHaveValue('Meeting Notes');
    expect(content()).toHaveValue('Body');
    expect(chip('Work')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('PromptEditor - Category', () => {
  it('checks the default Category, and only it, on a new Prompt', () => {
    renderEditor();

    const checked = within(categoryGroup()).getAllByRole('radio').filter(radio => radio.getAttribute('aria-checked') === 'true');
    expect(checked).toEqual([chip('Uncategorized')]);
  });

  it('keeps exactly one Category chosen, by click or arrow keys', async () => {
    const { props } = renderEditor();

    await userEvent.click(chip('Work'));
    expect(chip('Work')).toHaveAttribute('aria-checked', 'true');
    expect(chip('Uncategorized')).toHaveAttribute('aria-checked', 'false');

    await userEvent.keyboard('{ArrowRight}');
    expect(chip('Personal')).toHaveAttribute('aria-checked', 'true');
    expect(chip('Personal')).toHaveFocus();
    expect(chip('Work')).toHaveAttribute('aria-checked', 'false');

    await userEvent.type(content(), 'Body');
    await userEvent.click(save());
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: '', content: 'Body', category: 'Personal' });
    });
  });

  it('creates a Category with the first unused preset color and chooses it', async () => {
    const { props } = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    // Work already uses the first preset color: the second one is offered
    expect(screen.getByRole('button', { name: `Change color, now ${PRESET_COLORS[1].name}` })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New category name'), '  Research');
    await userEvent.keyboard('{Enter}');

    expect(props.onCreateCategory).toHaveBeenCalledWith({ name: '  Research', color: PRESET_COLORS[1].value });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('cycles the new Category color', async () => {
    const { props } = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    await userEvent.click(screen.getByRole('button', { name: /^Change color/ }));
    await userEvent.type(screen.getByLabelText('New category name'), 'Research');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(props.onCreateCategory).toHaveBeenCalledWith({ name: 'Research', color: PRESET_COLORS[2].value });
  });

  it('chooses the created Category under its stored name', async () => {
    const created: Category = { id: 'r', name: 'Research', color: PRESET_COLORS[1].value };
    const onCreateCategory = vi.fn().mockResolvedValue(created);
    const { rerender, props } = renderEditor({ onCreateCategory });

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    await userEvent.type(screen.getByLabelText('New category name'), 'Research');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    rerender(<PromptEditor {...props} categories={[...categories, created]} />);

    expect(chip('Research')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByLabelText('New category name')).not.toBeInTheDocument();
  });

  it('shows why a new Category is refused and keeps the name to correct', async () => {
    const onCreateCategory = vi.fn().mockRejectedValue(new Error('Category with name "Work" already exists'));
    renderEditor({ onCreateCategory });

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    await userEvent.type(screen.getByLabelText('New category name'), 'work');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Category with name "Work" already exists');
    expect(screen.getByLabelText('New category name')).toHaveValue('work');
    expect(chip('Uncategorized')).toHaveAttribute('aria-checked', 'true');
  });

  it('closes the new Category row with Escape without leaving the editor', async () => {
    const { props } = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    await userEvent.type(screen.getByLabelText('New category name'), 'Draft');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByLabelText('New category name')).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('PromptEditor - Variables', () => {
  it('lists the Variables of the text, each once, in order', async () => {
    renderEditor();

    await userEvent.click(content());
    await userEvent.paste('Email {{recipient}} about {{ goal }}, then {{recipient}} again');

    const list = within(screen.getByRole('region', { name: 'Variables' })).getAllByRole('listitem');
    expect(list.map(item => item.textContent)).toEqual(['recipient', 'goal']);
  });

  it('highlights each Variable in the text', async () => {
    renderEditor();

    await userEvent.click(content());
    await userEvent.paste('Hi {{name}}!');

    const marks = screen.getByTestId('variable-mirror').querySelectorAll('mark');
    expect([...marks].map(mark => mark.textContent)).toEqual(['{{name}}']);
  });

  it('explains how to add a Variable when the text has none', () => {
    renderEditor();

    expect(screen.getByText('Type {{name}} to add a Variable you fill in at Insertion.')).toBeInTheDocument();
  });

  it('hands the text over Verbatim, spaces and line breaks at both ends included', async () => {
    const { props } = renderEditor();
    const text = '  \n{{a}} body\t{{ b }}\n\n ';

    await userEvent.click(content());
    await userEvent.paste(text);
    expect(screen.getByTestId('variable-mirror').textContent).toBe(`${text}\u200b`);
    await userEvent.click(save());

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: '', content: text, category: 'Uncategorized' });
    });
  });
});

describe('PromptEditor - motion', () => {
  it('chips change color over a transition, press with a spring, and the check of the chosen one pops', async () => {
    renderEditor();
    const work = chip('Work');
    expect(work).toHaveClass('transition-chip', 'active:scale-92');
    expect(work.querySelector('svg')).toBeNull();

    await userEvent.click(work);

    expect(work.querySelector('svg')).toHaveClass('animate-pop-check');
  });

  it('pops the new Category row in', async () => {
    renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'New category' }));

    expect(screen.getByLabelText('New category name').closest('[data-keeps-escape]')).toHaveClass('animate-pop-check');
  });

  it('pops each new Variable in, and leaves the ones already there alone', async () => {
    renderEditor();
    const variables = () => within(screen.getByRole('region', { name: 'Variables' })).getAllByRole('listitem');

    await userEvent.click(content());
    await userEvent.paste('Hello {{name}}');
    const [first] = variables();
    expect(first).toHaveClass('animate-pop');

    await userEvent.paste(', from {{city}}');

    const after = variables();
    expect(after).toHaveLength(2);
    // The same element: its entrance has already played and does not replay
    expect(after[0]).toBe(first);
    expect(after[1]).toHaveClass('animate-pop');
  });
});

describe('PromptEditor - save', () => {
  it('shows "Saved", then closes the editor', async () => {
    const { props } = renderEditor();

    await userEvent.type(title(), 'My Title');
    await userEvent.type(content(), 'My Content');
    await userEvent.click(save());

    expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled();
    expect(props.onSubmit).toHaveBeenCalledWith({ title: 'My Title', content: 'My Content', category: 'Uncategorized' });
    expect(props.onClose).not.toHaveBeenCalled();
    await waitFor(() => { expect(props.onClose).toHaveBeenCalledTimes(1); }, { timeout: MOTION.savedPause + 500 });
  });

  it('gives the title the keyboard as it opens', () => {
    renderEditor();

    expect(title()).toHaveFocus();
  });

  it('slides Save to the success color, with a check that pops, and presses with a spring', async () => {
    renderEditor();
    expect(save()).toHaveClass('transition-save', 'active:scale-94');

    await userEvent.type(content(), 'My Content');
    await userEvent.click(save());

    const saved = await screen.findByRole('button', { name: 'Saved' });
    expect(saved).toHaveClass('bg-success-subtle', 'text-success', 'transition-save');
    expect(saved.querySelector('svg')).toHaveClass('animate-pop-check');
  });

  it('closes at once after "Saved" under prefers-reduced-motion', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    const { props } = renderEditor();

    await userEvent.type(content(), 'My Content');
    await userEvent.click(save());

    await waitFor(() => { expect(props.onClose).toHaveBeenCalledTimes(1); }, { timeout: 100 });
  });

  it.each([
    ['Cmd+S', '{Meta>}s{/Meta}'],
    ['Ctrl+S', '{Control>}s{/Control}']
  ])('saves with %s', async (_name, keys) => {
    const { props } = renderEditor();

    await userEvent.type(content(), 'Body');
    await userEvent.keyboard(keys);

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: '', content: 'Body', category: 'Uncategorized' });
    });
  });

  it('refuses empty content without submitting', async () => {
    const { props } = renderEditor();

    await userEvent.click(save());

    expect(await screen.findByText(/Content is required/)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('shows the reason and stays open when the save is refused', async () => {
    const { props } = renderEditor({ onSubmit: vi.fn().mockRejectedValue(new Error('Storage is full')) });

    await userEvent.type(content(), 'Body');
    await userEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
    expect(content()).toHaveValue('Body');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('says there is nothing to save when an edit changes nothing', async () => {
    const { props } = renderEdit();

    await userEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent('No changes to save');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  // An edit has no title to generate (create does): a blank one is refused here
  it('refuses a cleared title in an edit', async () => {
    const { props } = renderEdit();

    await userEvent.clear(title());
    await userEvent.click(save());

    expect(await screen.findByText(/Title is required/)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe('PromptEditor - Cancel', () => {
  it('leaves at once when nothing changed', async () => {
    const { props } = renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before discarding changes, on Cancel and on Escape', async () => {
    const { props } = renderEdit();

    await userEvent.type(content(), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(content()).toHaveValue('Body more');

    await userEvent.click(content());
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('counts a new Category choice as a change', async () => {
    renderEditor();

    await userEvent.click(chip('Work'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });
});

describe('PromptEditor - counter', () => {
  it('counts characters, and shows the date of the last edit when editing', () => {
    renderEdit();

    expect(screen.getByText('4 characters')).toBeInTheDocument();
    expect(screen.getByText(/^Edited /)).toBeInTheDocument();
  });

  it('shows the limit once the text is close to it, in red past it', async () => {
    renderEditor();
    const near = 'x'.repeat(PROMPT_LIMITS.content * 0.95);

    await userEvent.click(content());
    await userEvent.paste(near);
    expect(screen.getByText(formatCharacterCount(near.length, PROMPT_LIMITS.content))).not.toHaveClass('text-danger');

    await userEvent.paste('x'.repeat(PROMPT_LIMITS.content));
    expect(screen.getByText(formatCharacterCount(near.length + PROMPT_LIMITS.content, PROMPT_LIMITS.content))).toHaveClass('text-danger');
  });
});

// ADR-001: over-limit text is refused, never shortened. A maxLength attribute would let the
// browser cut a paste at the limit without a word, so the fields have none; the text stays in
// the field, the counter turns red and the refusal is shown instead.
describe('PromptEditor - limits', () => {
  it('keeps content pasted over the limit in the field, shows the refusal and does not submit', async () => {
    const { props } = renderEdit();
    const overLimit = 'x'.repeat(PROMPT_LIMITS.content + 1);

    await userEvent.clear(content());
    await userEvent.paste(overLimit);

    expect(content()).toHaveValue(overLimit);
    expect(screen.getByText(formatCharacterCount(overLimit.length, PROMPT_LIMITS.content))).toHaveClass('text-danger');
    await userEvent.click(save());

    expect(await screen.findByText('Content cannot exceed 20,000 characters')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a title pasted over the limit in the field, shows the refusal and does not submit', async () => {
    const { props } = renderEditor();
    const longTitle = 't'.repeat(PROMPT_LIMITS.title + 1);

    await userEvent.click(title());
    await userEvent.paste(longTitle);
    await userEvent.type(content(), 'Body');

    expect(title()).toHaveValue(longTitle);
    expect(screen.getByText(formatCharacterCount(longTitle.length, PROMPT_LIMITS.title))).toHaveClass('text-danger');
    await userEvent.click(save());

    expect(await screen.findByText('Title cannot exceed 100 characters')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('accepts content over the limit only because of a Hidden character and hands it over unchanged', async () => {
    const { props } = renderEditor();
    const text = `${'x'.repeat(PROMPT_LIMITS.content)}\u{200B}`;

    await userEvent.click(content());
    await userEvent.paste(text);
    await userEvent.click(save());

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: '', content: text, category: 'Uncategorized' });
    });
  });

  // React 19 resets the uncontrolled fields of a form once its action completes, so a refused
  // save must not put back the stored text: what the user typed stays, with the refusal next to it
  it('keeps the title, content and Category exactly as typed when the save is refused, then saves the corrected text', async () => {
    const { props } = renderEdit();
    const overLimit = 'x'.repeat(PROMPT_LIMITS.content + 1);

    await userEvent.clear(title());
    await userEvent.type(title(), 'New Title');
    await userEvent.click(chip('Uncategorized'));
    await userEvent.clear(content());
    await userEvent.paste(overLimit);
    await userEvent.click(save());

    expect(await screen.findByText('Content cannot exceed 20,000 characters')).toBeInTheDocument();
    expect(title()).toHaveValue('New Title');
    expect(content()).toHaveValue(overLimit);
    expect(chip('Uncategorized')).toHaveAttribute('aria-checked', 'true');
    expect(props.onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(content());
    await userEvent.paste('New body');
    await userEvent.click(save());

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: 'New Title', content: 'New body', category: 'Uncategorized' });
    });
  });
});

describe('PromptEditor - Delete prompt', () => {
  it('has no Delete prompt for a new Prompt', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: 'Delete prompt' })).not.toBeInTheDocument();
  });

  it('asks for confirmation, then deletes', async () => {
    const { props } = renderEdit();

    await userEvent.click(screen.getByRole('button', { name: 'Delete prompt' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Are you sure you want to delete "Meeting Notes"?');
    expect(props.onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith('p1');
  });

  it('keeps the Prompt when the confirmation is cancelled, and Escape does not leave the editor', async () => {
    const { props } = renderEdit();

    await userEvent.click(screen.getByRole('button', { name: 'Delete prompt' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe('PromptEditor - Share code', () => {
  const decoded = { title: 'Shared Title', content: 'Shared Content', category: 'Work' };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(promptEncoder, 'decode').mockReturnValue(decoded);
  });

  const openImport = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Paste a Share code' }));
  };

  it('is offered for a new Prompt only', () => {
    renderEdit();

    expect(screen.queryByRole('button', { name: 'Paste a Share code' })).not.toBeInTheDocument();
  });

  it('replaces the title and text with a Share code field, and back', async () => {
    renderEditor();

    await openImport();
    expect(screen.getByLabelText('Share code')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(save()).toHaveTextContent('Import');
    expect(save()).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Write a new prompt instead' }));
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.queryByLabelText('Share code')).not.toBeInTheDocument();
  });

  it('opens the code, previews the Prompt and chooses the Category it names', async () => {
    renderEditor();

    await openImport();
    await userEvent.type(screen.getByLabelText('Share code'), 'code');

    expect(await screen.findByText('Share code opened')).toBeInTheDocument();
    expect(promptEncoder.decode).toHaveBeenCalledWith('code');
    expect(screen.getByText('Shared Title')).toBeInTheDocument();
    expect(screen.getByText('Shared Content')).toBeInTheDocument();
    expect(chip('Work')).toHaveAttribute('aria-checked', 'true');
    expect(save()).toBeEnabled();
  });

  it('falls back to the default Category when the one named is not in the Library', async () => {
    vi.mocked(promptEncoder.decode).mockReturnValue({ ...decoded, category: 'Elsewhere' });
    renderEditor();

    await openImport();
    await userEvent.type(screen.getByLabelText('Share code'), 'code');

    await screen.findByText('Share code opened');
    expect(chip('Uncategorized')).toHaveAttribute('aria-checked', 'true');
  });

  it('imports the shared Prompt into the Category chosen', async () => {
    const { props } = renderEditor();

    await openImport();
    await userEvent.type(screen.getByLabelText('Share code'), 'code');
    await screen.findByText('Share code opened');
    await userEvent.click(chip('Personal'));
    await userEvent.click(save());

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: 'Shared Title', content: 'Shared Content', category: 'Personal' });
    });
  });

  it('shows why a code cannot be opened and keeps Import off', async () => {
    vi.mocked(promptEncoder.decode).mockImplementation(() => { throw new Error('Invalid sharing code format'); });
    renderEditor();

    await openImport();
    await userEvent.type(screen.getByLabelText('Share code'), 'garbage');

    expect(await screen.findByText('Invalid sharing code format')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('clears the preview when the code is cleared', async () => {
    renderEditor();

    await openImport();
    await userEvent.type(screen.getByLabelText('Share code'), 'code');
    await screen.findByText('Share code opened');
    await userEvent.clear(screen.getByLabelText('Share code'));

    expect(screen.queryByText('Shared Title')).not.toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});

describe('PromptEditor - a Prompt that looks familiar', () => {
  // 40 characters; the text typed below changes 16 of them, so it is 60% like it
  const summarize: Prompt = {
    id: 'summarize',
    title: 'Summarize an article',
    content: 'Summarize this article in three bullets.',
    category: 'Uncategorized',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000
  };
  const SIXTY_PERCENT_LIKE = 'x'.repeat(16) + summarize.content.slice(16);
  const callout = () => screen.queryByRole('region', { name: 'This looks familiar' });

  const typeContent = async (text: string) => {
    await userEvent.click(content());
    await userEvent.paste(text);
  };

  it('points out the Prompt of the Library the text is like, with how alike they are', async () => {
    renderEditor({ library: [summarize] });

    await typeContent(SIXTY_PERCENT_LIKE);

    expect(await screen.findByRole('region', { name: 'This looks familiar' })).toHaveTextContent(
      '60% like “Summarize an article”'
    );
  });

  it('shows the first lines of the text typed and of the Prompt it is like', async () => {
    renderEditor({ library: [summarize] });

    await typeContent(SIXTY_PERCENT_LIKE);

    const found = await screen.findByRole('region', { name: 'This looks familiar' });
    expect(within(found).getByText('Yours').nextSibling).toHaveTextContent(SIXTY_PERCENT_LIKE);
    expect(within(found).getByText('Existing').nextSibling).toHaveTextContent(summarize.content);
  });

  it('Keep both hides it until the editor is closed, however the text changes', async () => {
    const { unmount } = renderEditor({ library: [summarize] });
    await typeContent(SIXTY_PERCENT_LIKE);

    await userEvent.click(await screen.findByRole('button', { name: 'Keep both' }));
    expect(callout()).not.toBeInTheDocument();
    await userEvent.clear(content());
    await typeContent(summarize.content);
    expect(callout()).not.toBeInTheDocument();

    unmount();
    renderEditor({ library: [summarize] });
    await typeContent(SIXTY_PERCENT_LIKE);
    expect(await screen.findByRole('region', { name: 'This looks familiar' })).toBeInTheDocument();
  });

  it('never points out the Prompt being edited', async () => {
    renderEdit({ prompt: summarize, library: [summarize] });

    await typeContent(' Keep it short.');

    expect(content()).toHaveValue(`${summarize.content} Keep it short.`);
    expect(callout()).not.toBeInTheDocument();
  });

  it('never blocks saving', async () => {
    const { props } = renderEditor({ library: [summarize] });
    await userEvent.type(title(), 'Mine');
    await typeContent(SIXTY_PERCENT_LIKE);
    await screen.findByRole('region', { name: 'This looks familiar' });

    await userEvent.click(save());

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: 'Mine', content: SIXTY_PERCENT_LIKE, category: 'Uncategorized' });
    });
  });
});
