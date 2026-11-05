/**
 * Variable fill-in form shown in the prompt selector before inserting a Prompt that has
 * Variables ({{name}}). One labelled field per distinct Variable; submit (Enter) fills them in,
 * Escape or "Insert as is" inserts the raw text.
 *
 * All user text (variable names) is set with textContent, never as markup.
 */

export interface VariableFormHandlers {
  /** Called with the value typed for each variable (possibly empty). */
  onSubmit: (values: Record<string, string>) => void;
  /** Called when the user chooses to insert the raw text (Escape or "Insert as is"). */
  onSkip: () => void;
}

export const createVariableForm = (variables: string[], handlers: VariableFormHandlers): HTMLFormElement => {
  const form = document.createElement('form');
  form.className = 'prompt-variables-form';
  form.setAttribute('aria-label', 'Fill in variables');
  form.noValidate = true;

  const inputs = variables.map((name, index) => {
    const id = `prompt-variable-${String(index)}`;

    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'prompt-variable-field';

    const label = document.createElement('label');
    label.className = 'prompt-variable-label';
    label.htmlFor = id;
    label.textContent = name;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'prompt-variable-input';
    input.setAttribute('autocomplete', 'off');

    fieldWrapper.appendChild(label);
    fieldWrapper.appendChild(input);
    form.appendChild(fieldWrapper);
    return { name, input };
  });

  const actions = document.createElement('div');
  actions.className = 'prompt-variables-actions';

  const skipButton = document.createElement('button');
  skipButton.type = 'button';
  skipButton.className = 'prompt-variables-skip';
  skipButton.textContent = 'Insert as is';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'prompt-variables-submit';
  submitButton.textContent = 'Insert';

  actions.appendChild(skipButton);
  actions.appendChild(submitButton);
  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values: Record<string, string> = {};
    for (const { name, input } of inputs) {
      values[name] = input.value;
    }
    handlers.onSubmit(values);
  });

  skipButton.addEventListener('click', () => {
    handlers.onSkip();
  });

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handlers.onSkip();
    }
  });

  return form;
};
