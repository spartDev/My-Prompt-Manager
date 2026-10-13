const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * The first `maxLength` UTF-16 code units of `text`, never ending between the two halves of
 * a surrogate pair (an emoji, for example): a pair that straddles the limit is left out whole.
 * Only the two code units around the cut are read, so the cost does not grow with the text.
 */
export function cutWithoutSplittingPairs(text: string, maxLength: number): string {
  const splitsPair =
    isHighSurrogate(text.charCodeAt(maxLength - 1)) &&
    isLowSurrogate(text.charCodeAt(maxLength));
  return text.substring(0, splitsPair ? maxLength - 1 : maxLength);
}
