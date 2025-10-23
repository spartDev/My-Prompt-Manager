/**
 * Dropdown Primitive Components
 *
 * A set of composable dropdown components using the compound component pattern,
 * inspired by Radix UI's API. Provides full keyboard navigation, ARIA support,
 * and flexible positioning using Floating UI.
 *
 * @example
 * ```tsx
 * <Dropdown.Root>
 *   <Dropdown.Trigger asChild>
 *     <button>Options</button>
 *   </Dropdown.Trigger>
 *
 *   <Dropdown.Content side="bottom" align="start">
 *     <Dropdown.Item onSelect={handleEdit}>Edit</Dropdown.Item>
 *     <Dropdown.Item onSelect={handleDuplicate}>Duplicate</Dropdown.Item>
 *     <Dropdown.Separator />
 *     <Dropdown.Item onSelect={handleDelete}>Delete</Dropdown.Item>
 *   </Dropdown.Content>
 * </Dropdown.Root>
 * ```
 */

import { Content } from './Content';
import { Group } from './Group';
import { Item } from './Item';
import { Label } from './Label';
import { Root } from './Root';
import { Separator } from './Separator';
import { Trigger } from './Trigger';

export const Dropdown = Object.assign(Root, {
  Root,
  Trigger,
  Content,
  Item,
  Separator,
  Group,
  Label
});

// Export individual components for direct import
export { Root } from './Root';
export { Trigger } from './Trigger';
export { Content } from './Content';
export { Item } from './Item';
export { Separator } from './Separator';
export { Group } from './Group';
export { Label } from './Label';

// Export types
export type { RootProps } from './Root';
export type { TriggerProps } from './Trigger';
export type { ContentProps } from './Content';
export type { ItemProps } from './Item';
export type { SeparatorProps } from './Separator';
export type { GroupProps } from './Group';
export type { LabelProps } from './Label';