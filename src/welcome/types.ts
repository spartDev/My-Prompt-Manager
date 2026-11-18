export interface PackPrompt { readonly title: string; readonly content: string }
export interface PromptPack { readonly id: string; readonly name: string; readonly color: string; readonly defaultSelected: boolean; readonly prompts: readonly PackPrompt[] }
