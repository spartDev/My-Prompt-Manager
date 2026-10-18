<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements Component Catalog

> **Important**: This file shows API usage patterns, not component availability. Always run Phase 1: Discovery (read `package.json` and `node_modules/index.d.ts`) to confirm which components exist in the team's installed version before using any component listed here.

## Table of Contents

- [Typography](#typography)
- [Button & Actions](#button--actions)
- [Layout](#layout)
- [Navigation](#navigation)
- [Card](#card)
- [Form Components](#form-components)
- [Feedback](#feedback)
- [Data Display](#data-display)
- [Content](#content)
- [Hooks](#hooks)

---

## Typography

### Title

```tsx
<Title variant={TitleVariant.TITLE_1}>Page Title</Title>    // largest
<Title variant={TitleVariant.TITLE_2}>Section</Title>
<Title variant={TitleVariant.TITLE_3}>Subsection</Title>
<Title variant={TitleVariant.TITLE_4}>Card Title</Title>
<Title variant={TitleVariant.TITLE_5}>Small Title</Title>   // smallest
```

Supports `as` prop: `<Title as="h2" variant={TitleVariant.TITLE_1}>`.

### Typography

```tsx
// Body text
<Typography variant={TypographyVariant.BODY_LARGE}>Large body</Typography>
<Typography variant={TypographyVariant.BODY_MEDIUM}>Default body</Typography>
<Typography variant={TypographyVariant.BODY_SMALL}>Small body</Typography>
<Typography variant={TypographyVariant.BODY_XSMALL}>Extra small</Typography>

// Display (hero text)
<Typography variant={TypographyVariant.DISPLAY_1}>Display 1</Typography>
<Typography variant={TypographyVariant.DISPLAY_2}>Display 2</Typography>

// Editorial
<Typography variant={TypographyVariant.EDITORIAL_1}>Editorial 1</Typography>
<Typography variant={TypographyVariant.EDITORIAL_2}>Editorial 2</Typography>

// Labels
<Typography variant={TypographyVariant.EYEBROW_MEDIUM}>Label</Typography>
<Typography variant={TypographyVariant.EYEBROW_SMALL}>Small label</Typography>

// Legal
<Typography variant={TypographyVariant.LEGAL_COPY}>Legal</Typography>
<Typography variant={TypographyVariant.LEGAL_COPY_SMALL}>Small legal</Typography>

// Color
<Typography color={TypographyColor.SUBTLE}>Subtle text</Typography>
<Typography color={TypographyColor.INVERSE}>Inverse text</Typography>
<Typography color={TypographyColor.ERROR}>Error text</Typography>
<Typography color={TypographyColor.SUCCESS}>Success text</Typography>
<Typography color={TypographyColor.DISABLED}>Disabled text</Typography>

// Font weight
<Typography fontWeight={TypographyFontWeight.BOLD}>Bold text</Typography>
```

### Link

```tsx
<Link href="/page" variant={LinkVariant.INLINE}>Inline link</Link>
<Link href="/page" variant={LinkVariant.STANDALONE} size={LinkSize.LARGE}>Standalone</Link>
<Link href="/page" variant={LinkVariant.STANDALONE} icon={IconName.ARROW_FORWARD} iconPosition={IconPosition.END}>With icon</Link>
```

---

## Button & Actions

### Button

Variants: `PRIMARY`, `PRIMARY_NEUTRAL`, `PRIMARY_DESTRUCT`, `SECONDARY`, `SECONDARY_NEUTRAL`, `SECONDARY_DESTRUCT`, `TERTIARY`, `TERTIARY_NEUTRAL`, `TERTIARY_DESTRUCT`

Sizes: `XSMALL`, `SMALL`, `MEDIUM`, `LARGE`

```tsx
<Button variant={ButtonVariant.PRIMARY} size={ButtonSize.MEDIUM} label="Action" />
<Button variant={ButtonVariant.SECONDARY} label="Cancel" />
<Button variant={ButtonVariant.TERTIARY} label="Learn more" />

// With icon
<Button variant={ButtonVariant.PRIMARY} icon={IconName.ARROW_FORWARD} iconPosition={IconPosition.END} label="Next" />

// As link
<Button as="a" href="/page" variant={ButtonVariant.PRIMARY} label="Go" />

// Loading state
<Button variant={ButtonVariant.PRIMARY} isLoading label="Saving..." />

// Full width
<Button variant={ButtonVariant.PRIMARY} fullWidth label="Submit" />

// Destructive
<Button variant={ButtonVariant.PRIMARY_DESTRUCT} label="Delete" />
```

### ButtonIcon

```tsx
<ButtonIcon icon={IconName.CLOSE} variant={ButtonVariant.TERTIARY} aria-label="Close" />
<ButtonIcon icon={IconName.SEARCH} size={ButtonSize.SMALL} aria-label="Search" />
```

### Icon

```tsx
<Icon name={IconName.SEARCH} size={1} />
<Icon name={IconName.HOME} size={1.5} />
<Icon name={IconName.CHECK_CIRCLE} size={2} inverse />
```

~3,634 Material Design icons available via `IconName`.

---

## Layout

### Container

```tsx
<Container>Responsive max-width container</Container>
<Container as="section">As section element</Container>
```

### Grid (12-column)

```tsx
<Grid.Root>
  <Grid.Item xs={12} sm={6} md={4} lg={3}>Column</Grid.Item>
  <Grid.Item xs={12} sm={6} md={4} lg={3}>Column</Grid.Item>
  <Grid.Item xs={12} sm={12} md={4} lg={6}>Column</Grid.Item>
</Grid.Root>
```

Column sizes: 1-12 per breakpoint. Sizes inherit upward (xs applies to all unless overridden).

### Flex

```tsx
<Flex direction="row" gap="md" align="center" justify="between" wrap="wrap">
  <Flex.Item>Item</Flex.Item>
  <Flex.Item>Item</Flex.Item>
</Flex>
```

Props: `direction` (row|column|row-reverse|column-reverse), `gap` (spacing tokens), `align` (start|center|end|baseline|stretch), `justify` (start|center|end|between|around|evenly), `wrap` (nowrap|wrap|wrap-reverse).

### Divider

```tsx
<Divider />
<Divider orientation={Orientation.VERTICAL} />
```

### ContentBlock

```tsx
<ContentBlock padding={ContentBlockPadding.MD}>
  Padded content section
</ContentBlock>
```

Padding options: `NONE`, `XS`, `SM`, `MD`, `LG`, `XL`.

---

## Navigation

### NavigationHeader

```tsx
// In your .module.scss: .logo { width: 80px; }
<NavigationHeader.Root
  logo={<img src="/logo.svg" alt="Logo" className={styles.logo} />}
  mobileMenuIcon={<ButtonIcon icon={IconName.MENU} size={ButtonSize.SMALL} variant={ButtonVariant.TERTIARY} />}
>
  <NavigationHeader.StartContent>
    <NavigationHeader.Item>
      <NavigationHeader.Action as="a" href="/about">About</NavigationHeader.Action>
    </NavigationHeader.Item>

    {/* With MegaMenu */}
    <NavigationHeader.Item>
      <MegaMenu.Trigger menuContent={
        <Grid.Root>
          <CascadingMenu.Root>
            <Grid.Item sm={12} md={3}>
              <MegaMenu.Title>Products</MegaMenu.Title>
              <CascadingMenu.Item label="Product A" />
              <CascadingMenu.Item label="Product B" />
            </Grid.Item>
          </CascadingMenu.Root>
        </Grid.Root>
      }>
        <NavigationHeader.Action>Solutions</NavigationHeader.Action>
      </MegaMenu.Trigger>
    </NavigationHeader.Item>
  </NavigationHeader.StartContent>

  <NavigationHeader.EndContent>
    <NavigationHeader.Item>
      <Button label="Contact" variant={ButtonVariant.PRIMARY} />
    </NavigationHeader.Item>
  </NavigationHeader.EndContent>

  <NavigationHeader.QuickAction>
    <ButtonIcon icon={IconName.SEARCH} size={ButtonSize.SMALL} aria-label="Search" />
  </NavigationHeader.QuickAction>
</NavigationHeader.Root>
```

### Sidebar

```tsx
<Sidebar.Root collapsible>
  <Sidebar.Header logo={<Logo />} />
  <Sidebar.Content>
    <Sidebar.Section title="Navigation">
      <Sidebar.Item icon={IconName.HOME}>Home</Sidebar.Item>
      <Sidebar.Item icon={IconName.SETTINGS} expandable nestedItems={[
        <Sidebar.Item key="1">Sub Item 1</Sidebar.Item>,
        <Sidebar.Item key="2">Sub Item 2</Sidebar.Item>,
      ]}>Settings</Sidebar.Item>
    </Sidebar.Section>
  </Sidebar.Content>
  <Sidebar.Footer>
    <Sidebar.UserProfile name="User" email="user@example.com" />
  </Sidebar.Footer>
</Sidebar.Root>
```

### Breadcrumb

```tsx
<Breadcrumb>
  <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
  <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
  <Breadcrumb.Item aria-current="page">Current</Breadcrumb.Item>
</Breadcrumb>
```

### Tabs

```tsx
<Tabs defaultSelected="tab1">
  <Tabs.List>
    <Tabs.Tab name="tab1">First</Tabs.Tab>
    <Tabs.Tab name="tab2">Second</Tabs.Tab>
    <Tabs.Tab name="tab3" disabled>Disabled</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel name="tab1">First content</Tabs.Panel>
  <Tabs.Panel name="tab2">Second content</Tabs.Panel>
</Tabs>

// Lazy mounting for performance
<Tabs lazyMount unmountOnHide>...</Tabs>
```

### Pagination

```tsx
<Pagination currentPage={1} totalPages={10} onPageChange={setPage} />
```

---

## Card

```tsx
// Grid layout
<Card type={CardType.GRID}>
  <Card.Section>
    <Card.Media><Image src="image.jpg" alt="Description" /></Card.Media>
    <Card.Content
      category="Category"
      title={<Title variant={TitleVariant.TITLE_3}>Card Title</Title>}
      subText="Description text"
    >
      <Link href="/link">Learn more</Link>
    </Card.Content>
  </Card.Section>
  <Card.Section>
    <Card.Action>
      <Button variant={ButtonVariant.PRIMARY} label="Action" />
    </Card.Action>
  </Card.Section>
</Card>

// List layout
<Card type={CardType.LIST}>
  <Card.Section>
    <Card.Media><Image src="image.jpg" alt="" /></Card.Media>
    <Card.Content title="Title" subText="Description" />
  </Card.Section>
</Card>
```

Density: `CardDensity.DEFAULT`, `CardDensity.TIGHT`.

### CardGroup

```tsx
<CardGroup>{/* multiple Card components */}</CardGroup>
```

---

## Form Components

### TextInput

```tsx
<TextInput label="Email" placeholder="Enter email" onChange={handleChange} />
<TextInput label="Name" required />
<TextInput label="Email" state={FormControlState.ERROR} subText="Invalid email" />
<TextInput label="Search" state={FormControlState.SUCCESS} subText="Available" />
<TextInput label="Notes" disabled />
```

Sizes: `InputSize.SMALL`, `InputSize.MEDIUM`, `InputSize.LARGE`.

### TextArea

```tsx
<TextArea label="Description" placeholder="Enter description" rows={4} />
```

### Select

```tsx
<Select label="Country" placeholder="Select a country" onChange={handleChange}>
  <Select.Option value="us">United States</Select.Option>
  <Select.Option value="fr">France</Select.Option>
</Select>
```

### Checkbox / CheckboxGroup

```tsx
<Checkbox label="I agree to terms" onChange={handleChange} />

<CheckboxGroup title="Select options" caption="Choose all that apply">
  <Checkbox label="Option 1" />
  <Checkbox label="Option 2" />
  <Checkbox label="Option 3" />
</CheckboxGroup>
```

### Radio / RadioGroup

```tsx
<RadioGroup title="Select one" onChange={handleChange}>
  <Radio label="Option A" value="a" />
  <Radio label="Option B" value="b" />
  <Radio label="Option C" value="c" />
</RadioGroup>
```

### Switch / SwitchGroup

```tsx
<Switch label="Enable notifications" onChange={handleChange} />

<SwitchGroup title="Settings">
  <Switch label="Email" />
  <Switch label="Push" />
</SwitchGroup>
```

### DatePicker

```tsx
<DatePicker label="Start date" onChange={handleDateChange} />
```

### SearchInput

```tsx
<SearchInput placeholder="Search..." onSearch={handleSearch} />
<SearchInput variant={SearchInputVariant.SUBMIT} placeholder="Search..." />
```

### Slider

```tsx
<Slider label="Volume" min={0} max={100} defaultValue={50} onChange={handleChange} />
```

### FileUploader

```tsx
<FileUploader label="Upload document" accept=".pdf,.doc" onChange={handleFileChange} />
```

### Autocomplete

```tsx
<Autocomplete label="City" options={cities} onChange={handleChange} />
```

---

## Feedback

### Modal

```tsx
<Modal
  isVisible={isOpen}
  title="Confirm Action"
  textContent="Are you sure you want to proceed?"
  onClose={handleClose}
  footerContent={
    <>
      <Button variant={ButtonVariant.SECONDARY} label="Cancel" onClick={handleClose} />
      <Button variant={ButtonVariant.PRIMARY} label="Confirm" onClick={handleConfirm} />
    </>
  }
/>
```

### Drawer

```tsx
<Drawer isVisible={isOpen} title="Settings" onClose={handleClose}>
  <Typography variant={TypographyVariant.BODY_MEDIUM}>Drawer content</Typography>
</Drawer>
```

### Toast

```tsx
// Render Toast at app root (inside ThemeProvider)
<Toast />

// Trigger via imperative API
import { toast } from "@sanofi-accelerator/elements";
toast.success("Saved successfully");
toast.error("Something went wrong");
toast.info("New update available");
```

### Tooltip

```tsx
<Tooltip content="Helpful information">
  <Button variant={ButtonVariant.TERTIARY} label="Hover me" />
</Tooltip>
```

### Banner

```tsx
<Banner title="Announcement" description="New features available." onClose={handleClose} />
```

### ProgressBar

```tsx
<ProgressBar value={60} state={ProgressBarState.IN_PROGRESS} size={ProgressBarSize.MEDIUM} />
<ProgressBar value={100} state={ProgressBarState.SUCCESS} />
<ProgressBar value={30} state={ProgressBarState.ERROR} />
```

Density: `DEFAULT`, `COMPACT`, `ULTRA_COMPACT`.

### LoadingSpinner

```tsx
<LoadingSpinner />
<LoadingSpinner size={2} />
```

### ProgressStepper

```tsx
<ProgressStepper currentStep={2} steps={["Details", "Review", "Confirm"]} />
```

---

## Data Display

### Menu

```tsx
<Menu>
  <Menu.Item onClick={handleEdit}>Edit</Menu.Item>
  <Menu.Item onClick={handleDelete}>Delete</Menu.Item>
  <Menu.Divider />
  <Menu.Item disabled>Archive</Menu.Item>
</Menu>
```

### Chips

```tsx
<ChipSelect>Selected</ChipSelect>
<ChipFilter onDelete={handleDelete}>Filterable</ChipFilter>
<ChipStatus>Active</ChipStatus>
<ChipDropdown options={options} onChange={handleChange}>Dropdown</ChipDropdown>
```

Size: `ChipSize.SMALL`, `ChipSize.MEDIUM`.

### Tag

```tsx
<Tag>Category</Tag>
```

### TreeView

```tsx
<TreeView decoration={TreeViewDecoration.ARROW_FOLDER} colorAccent={TreeViewColorAccent.BRANDED}>
  {/* tree items */}
</TreeView>
```

---

## Content

### Hero

```tsx
<Hero
  title={<Title variant={TitleVariant.TITLE_1}>Welcome</Title>}
  description={<Typography variant={TypographyVariant.BODY_LARGE}>Description</Typography>}
  media={<Image src="hero.jpg" alt="" />}
  actions={<Button variant={ButtonVariant.PRIMARY} label="Get Started" />}
/>
```

### Accordion

```tsx
<Accordion isExclusive>
  <Accordion.Item>
    <Accordion.Header>Section 1</Accordion.Header>
    <Accordion.Panel>
      <Typography variant={TypographyVariant.BODY_MEDIUM}>Content</Typography>
    </Accordion.Panel>
  </Accordion.Item>
</Accordion>
```

Size: `AccordionSize.SMALL`, `AccordionSize.MEDIUM`.

### Avatar / AvatarGroup

```tsx
<Avatar src="user.jpg" alt="User Name" />
<AvatarGroup max={3}>
  <Avatar src="user1.jpg" alt="User 1" />
  <Avatar src="user2.jpg" alt="User 2" />
  <Avatar src="user3.jpg" alt="User 3" />
</AvatarGroup>
```

### Image

```tsx
<Image src="photo.jpg" alt="Description" />
```

### Carousel

```tsx
<Carousel>
  <Carousel.Slide><Image src="slide1.jpg" alt="" /></Carousel.Slide>
  <Carousel.Slide><Image src="slide2.jpg" alt="" /></Carousel.Slide>
</Carousel>
```

### VideoThumbnail

```tsx
<VideoThumbnail src="thumbnail.jpg" alt="Video title" onClick={handlePlay} />
```

### IsiTray

```tsx
<IsiTray title="Important Safety Information">
  <Typography variant={TypographyVariant.BODY_SMALL}>Safety content...</Typography>
</IsiTray>
```

---

## Hooks

| Hook | Returns | Usage |
|------|---------|-------|
| `useBreakpoint(ref?)` | `"xs"\|"sm"\|"md"\|"lg"\|"xl"\|"xxl"\|"xxxl"` | Responsive logic |
| `useFocusTrap(ref, isActive)` | void | Trap focus in modals/drawers |
| `useReducedMotion()` | boolean | Respect prefers-reduced-motion |
| `useTextOverflow()` | `{ ref, isOverflowing, checkOverflow }` | Detect text truncation |
| `useTheme()` | Theme context value | Access current theme |
| `useBrandTheme(brandTheme?)` | CSS class names | Apply brand theme classes |
