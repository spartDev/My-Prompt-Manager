# Schibsted Grotesk

The font of the popup, side panel and Analytics page, declared by the `@font-face` in `src/popup.css`.

- Source: `ofl/schibstedgrotesk/SchibstedGrotesk[wght].ttf` of [google/fonts](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/schibstedgrotesk) at commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (version 1.100, variable `wght` axis 400 to 900).
- `SchibstedGrotesk-latin.woff2` is that file subset to Google Fonts' Latin range and compressed to woff2 with fontTools:

  ```bash
  pyftsubset 'SchibstedGrotesk[wght].ttf' --output-file=SchibstedGrotesk-latin.woff2 --flavor=woff2 --layout-features='*' \
    --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
  ```

- Licence: SIL Open Font License 1.1, `OFL.txt`, copied unchanged from the same commit.

Characters outside that range (Cyrillic, Greek, CJK, emoji…) fall back to the system font of the stack.
