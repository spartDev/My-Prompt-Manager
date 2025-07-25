# Extension Icons Guide

The extension needs proper icons for Chrome Web Store submission. Currently, the `public/icons/` directory contains placeholder files.

## Required Icon Sizes

- **16x16px** - Toolbar icon (shown in browser toolbar)
- **32x32px** - Extension management page  
- **48x48px** - Extension management page
- **128x128px** - Chrome Web Store listing

## Icon Design Guidelines

### Visual Identity
- **Theme:** Document/library concept with modern design
- **Colors:** Use primary brand colors (#3B82F6 blue or similar)
- **Style:** Clean, minimal, recognizable at small sizes
- **Background:** Transparent or subtle background

### Design Concepts

#### Option 1: Document Stack Icon
```
📚 - Stylized stack of documents/papers
- Clean lines, minimal design
- Primary color with subtle shadows
- Represents library/collection concept
```

#### Option 2: Prompt/Text Icon  
```
💬 - Speech bubble with text lines
- Modern chat bubble design
- Represents prompts/text content
- Easy to recognize at small sizes
```

#### Option 3: Library/Bookmark Icon
```
🔖 - Bookmark or tag icon
- Simple geometric design
- Represents organization/categories
- Professional appearance
```

## Icon Creation Tools

### Free Options:
- **Canva** - Online design tool with templates
- **GIMP** - Free image editor
- **Figma** - Free web-based design tool
- **Inkscape** - Free vector graphics editor

### Paid Options:
- **Adobe Illustrator** - Professional vector design
- **Sketch** - UI/UX design tool (Mac only)
- **Affinity Designer** - One-time purchase design tool

## Icon Creation Steps

1. **Design at Largest Size (128px):**
   - Create icon at 128x128 resolution
   - Use vector format for scalability
   - Ensure design works at small sizes

2. **Create Multiple Sizes:**
   - Export 128px version as PNG
   - Scale down to 48px, 32px, 16px
   - Optimize each size for clarity

3. **Test at Different Sizes:**
   - View icons at actual display sizes
   - Ensure readability at 16px
   - Check Chrome toolbar appearance

4. **Save in Correct Location:**
   ```
   public/icons/
   ├── icon-16.png   (16x16)
   ├── icon-32.png   (32x32)
   ├── icon-48.png   (48x48)
   └── icon-128.png  (128x128)
   ```

## Design Specifications

### Technical Requirements:
- **Format:** PNG with transparency
- **Color Mode:** RGB
- **Background:** Transparent preferred
- **Quality:** High resolution, no pixelation

### Visual Requirements:
- **Contrast:** Clear visibility on light/dark backgrounds
- **Simplicity:** Avoid complex details that don't scale
- **Consistency:** All sizes should look cohesive
- **Uniqueness:** Distinctive from other extensions

## Icon Template Ideas

### Simple Text/Document Icon:
```css
/* Base design concept */
Background: Rounded rectangle (#3B82F6)
Foreground: White text lines or document symbol
Border: Subtle shadow for depth
Style: Flat design with minimal elements
```

### Library/Stack Icon:
```css
/* Layered design concept */
Background: Multiple overlapping rectangles
Colors: Primary blue with lighter variants
Effect: Subtle 3D effect showing depth
Symbol: Optional "P" or "📝" overlay
```

## Quick Creation with Canva

1. **Setup:**
   - Go to canva.com
   - Create custom size (128x128px)
   - Choose transparent background

2. **Design:**
   - Add shapes (rectangles, circles)
   - Use brand colors (#3B82F6)
   - Add text or symbols if needed
   - Keep design simple and clean

3. **Export:**
   - Download as PNG with transparent background
   - Create versions for all required sizes
   - Test visibility at small sizes

## Alternative: AI-Generated Icons

If you have access to AI image generators:

**Prompt Examples:**
- "Simple, clean icon for a text prompt library app, blue color scheme, minimal design, 128x128 pixels"
- "Modern document stack icon, flat design, blue and white colors, suitable for browser extension"
- "Professional bookmark or tag icon, minimalist style, for a productivity extension"

## Testing Your Icons

1. **Replace placeholder files** in `public/icons/`
2. **Rebuild extension:** `npm run build`
3. **Load in Chrome** and check toolbar appearance
4. **Test at different zoom levels**
5. **Verify in extension management page**

## Final Checklist

Before submission, ensure:
- [ ] All 4 icon sizes created (16, 32, 48, 128px)
- [ ] PNG format with transparency
- [ ] Clear visibility at all sizes
- [ ] Consistent design across sizes
- [ ] Professional appearance
- [ ] No copyright issues
- [ ] Files properly named and located

---

**Note:** The current placeholder icon files are empty and must be replaced with proper icons before Chrome Web Store submission.