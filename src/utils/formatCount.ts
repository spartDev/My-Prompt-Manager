/** A count with its noun: `1 prompt`, `0 prompts`, `2 prompts` */
export const formatCount = (count: number, singular: string, plural: string): string =>
  `${count.toString()} ${count === 1 ? singular : plural}`;
