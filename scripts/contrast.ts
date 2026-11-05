/**
 * Prints the WCAG contrast ratio of two colors with the app's own getContrastRatio, so a check agrees with the
 * unit tests to the last digit instead of re-deriving the math in another language.
 *
 * Usage: npx tsx scripts/contrast.ts <fg> <bg>, each #RRGGBB (the # is optional). It exits 2 on any other input.
 */
import { getContrastRatio } from '../src/constants/colors';

const HEX = /^#?[0-9a-f]{6}$/i;

const [fg, bg] = process.argv.slice(2);
if (!fg || !bg || !HEX.test(fg) || !HEX.test(bg)) {
  process.stderr.write('Usage: npx tsx scripts/contrast.ts <fg> <bg>, each #RRGGBB\n');
  process.exit(2);
}

const toHex = (color: string) => (color.startsWith('#') ? color : `#${color}`).toUpperCase();
const ratio = getContrastRatio(toHex(fg), toHex(bg));
const verdict = (min: number) => (ratio >= min ? 'pass' : 'fail');

process.stdout.write(
  `${ratio.toFixed(2)}:1  AA ${verdict(4.5)}, AAA ${verdict(7)}, AA large text ${verdict(3)}\n`
);
