import type { TooltipValueType } from 'recharts';

/** The name half of a Tooltip line, as recharts hands it to a formatter */
type TooltipName = string | number;

/** Tooltip line of a chart that counts insertions: "Uses : 12" */
export const formatUsesTooltip = (value: TooltipValueType | undefined): [TooltipValueType, TooltipName] => [
  value ?? 0,
  'Uses'
];

/** Tooltip line of the Platform pie: the Platform, then its insertions, "Claude : 12 uses" */
export const formatPlatformUsesTooltip = (
  value: TooltipValueType | undefined,
  platform: TooltipName | undefined
): [string, TooltipName] => [`${String(value ?? 0)} uses`, platform ?? ''];
