<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Page Layout Patterns

> **Important**: These patterns show composition approaches, not component availability. Always run Phase 1: Discovery first to confirm which components exist in the team's installed version. Adapt these patterns to use only discovered components.

Common page compositions using Elements Design System components.

## Table of Contents

- [Landing Page](#landing-page)
- [Dashboard with Sidebar](#dashboard-with-sidebar)
- [Form Page](#form-page)
- [Product Listing](#product-listing)
- [Settings Page](#settings-page)
- [Detail Page](#detail-page)

---

## Landing Page

Navigation + Hero + Content sections + Footer.

```tsx
import {
  ThemeProvider, AppTheme,
  NavigationHeader, MegaMenu, CascadingMenu,
  Hero, Container, Grid, Card, CardType,
  Title, TitleVariant, Typography, TypographyVariant,
  Button, ButtonVariant, ButtonIcon, ButtonSize,
  Image, Icon, IconName, Accordion, Footer, Toast,
} from "@sanofi-accelerator/elements";
import styles from "./LandingPage.module.scss";
// .logo { width: 80px; }

const LandingPage = () => (
  <ThemeProvider appTheme={AppTheme.SANOFI}>
    {/* Navigation */}
    <NavigationHeader.Root
      logo={<img src="/logo.svg" alt="Brand" className={styles.logo} />}
      mobileMenuIcon={
        <ButtonIcon icon={IconName.MENU} size={ButtonSize.SMALL} variant={ButtonVariant.TERTIARY} />
      }
    >
      <NavigationHeader.StartContent>
        <NavigationHeader.Item>
          <NavigationHeader.Action as="a" href="/products">Products</NavigationHeader.Action>
        </NavigationHeader.Item>
        <NavigationHeader.Item>
          <NavigationHeader.Action as="a" href="/about">About</NavigationHeader.Action>
        </NavigationHeader.Item>
      </NavigationHeader.StartContent>
      <NavigationHeader.EndContent>
        <NavigationHeader.Item>
          <Button label="Get Started" variant={ButtonVariant.PRIMARY} />
        </NavigationHeader.Item>
      </NavigationHeader.EndContent>
    </NavigationHeader.Root>

    {/* Hero */}
    <Hero
      title={<Title variant={TitleVariant.TITLE_1}>Welcome to Our Platform</Title>}
      description={
        <Typography variant={TypographyVariant.BODY_LARGE}>
          Build amazing experiences with our tools.
        </Typography>
      }
      media={<Image src="/hero.jpg" alt="" />}
      actions={
        <>
          <Button variant={ButtonVariant.PRIMARY} label="Get Started" />
          <Button variant={ButtonVariant.SECONDARY} label="Learn More" />
        </>
      }
    />

    {/* Features grid */}
    <Container>
      <Title variant={TitleVariant.TITLE_2}>Features</Title>
      <Grid.Root>
        {features.map((feature) => (
          <Grid.Item key={feature.id} xs={12} md={6} lg={4}>
            <Card type={CardType.GRID}>
              <Card.Section>
                <Card.Content
                  title={<Title variant={TitleVariant.TITLE_3}>{feature.title}</Title>}
                  subText={feature.description}
                />
              </Card.Section>
            </Card>
          </Grid.Item>
        ))}
      </Grid.Root>
    </Container>

    {/* FAQ */}
    <Container>
      <Title variant={TitleVariant.TITLE_2}>FAQ</Title>
      <Accordion isExclusive>
        {faqs.map((faq) => (
          <Accordion.Item key={faq.id}>
            <Accordion.Header>{faq.question}</Accordion.Header>
            <Accordion.Panel>
              <Typography variant={TypographyVariant.BODY_MEDIUM}>{faq.answer}</Typography>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Container>

    <Toast />
  </ThemeProvider>
);
```

---

## Dashboard with Sidebar

Sidebar navigation + main content area with data widgets.

```tsx
import {
  ThemeProvider, AppTheme,
  Sidebar, Container, Grid, Flex,
  Card, CardType, Title, TitleVariant,
  Typography, TypographyVariant, TypographyColor,
  Button, ButtonVariant, Icon, IconName,
  ProgressBar, ProgressBarState, ProgressBarSize,
  Tabs, Divider, Avatar, Toast,
} from "@sanofi-accelerator/elements";
import styles from "./Dashboard.module.scss";
// .layout { min-height: 100vh; }
// .main  { flex: 1; }

const Dashboard = () => (
  <ThemeProvider appTheme={AppTheme.INTERNAL_TOOLS}>
    <Flex direction="row" className={styles.layout}>
      {/* Sidebar */}
      <Sidebar.Root collapsible>
        <Sidebar.Header logo={<img src="/logo.svg" alt="App" />} />
        <Sidebar.Content>
          <Sidebar.Section title="Main">
            <Sidebar.Item icon={IconName.DASHBOARD}>Dashboard</Sidebar.Item>
            <Sidebar.Item icon={IconName.PEOPLE}>Users</Sidebar.Item>
            <Sidebar.Item icon={IconName.ANALYTICS}>Analytics</Sidebar.Item>
          </Sidebar.Section>
          <Sidebar.Section title="Admin">
            <Sidebar.Item icon={IconName.SETTINGS} expandable nestedItems={[
              <Sidebar.Item key="general">General</Sidebar.Item>,
              <Sidebar.Item key="security">Security</Sidebar.Item>,
            ]}>Settings</Sidebar.Item>
          </Sidebar.Section>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.UserProfile name="Jane Doe" email="jane@example.com" />
        </Sidebar.Footer>
      </Sidebar.Root>

      {/* Main content */}
      <div className={styles.main}>
        <Container>
          <Title variant={TitleVariant.TITLE_2}>Dashboard</Title>

          {/* Stats row */}
          <Grid.Root>
            <Grid.Item xs={12} sm={6} lg={3}>
              <Card type={CardType.GRID}>
                <Card.Section>
                  <Card.Content
                    title={<Typography variant={TypographyVariant.EYEBROW_SMALL} color={TypographyColor.SUBTLE}>Total Users</Typography>}
                  >
                    <Title variant={TitleVariant.TITLE_2}>12,345</Title>
                  </Card.Content>
                </Card.Section>
              </Card>
            </Grid.Item>
            {/* Repeat for other stats */}
          </Grid.Root>

          {/* Progress section */}
          <Card type={CardType.GRID}>
            <Card.Section>
              <Card.Content title={<Title variant={TitleVariant.TITLE_3}>Project Progress</Title>}>
                <ProgressBar value={72} state={ProgressBarState.IN_PROGRESS} size={ProgressBarSize.MEDIUM} />
              </Card.Content>
            </Card.Section>
          </Card>

          {/* Tabbed content */}
          <Tabs defaultSelected="overview">
            <Tabs.List>
              <Tabs.Tab name="overview">Overview</Tabs.Tab>
              <Tabs.Tab name="details">Details</Tabs.Tab>
              <Tabs.Tab name="activity">Activity</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel name="overview">
              <Typography variant={TypographyVariant.BODY_MEDIUM}>Overview content</Typography>
            </Tabs.Panel>
            <Tabs.Panel name="details">
              <Typography variant={TypographyVariant.BODY_MEDIUM}>Details content</Typography>
            </Tabs.Panel>
            <Tabs.Panel name="activity">
              <Typography variant={TypographyVariant.BODY_MEDIUM}>Activity content</Typography>
            </Tabs.Panel>
          </Tabs>
        </Container>
      </div>
    </Flex>
    <Toast />
  </ThemeProvider>
);
```

---

## Form Page

Multi-step form with validation.

```tsx
import {
  ThemeProvider, AppTheme,
  Container, Flex, Grid,
  Title, TitleVariant, Typography, TypographyVariant,
  TextInput, TextArea, Select, Checkbox, RadioGroup, Radio,
  DatePicker, Switch, FileUploader,
  Button, ButtonVariant, FormControlState,
  ProgressStepper, Card, CardType, Divider, Toast,
} from "@sanofi-accelerator/elements";

const FormPage = () => {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  return (
    <ThemeProvider appTheme={AppTheme.SANOFI}>
      <Container>
        <Title variant={TitleVariant.TITLE_1}>Registration</Title>
        <ProgressStepper currentStep={step} steps={["Personal Info", "Preferences", "Review"]} />

        {step === 0 && (
          <Card type={CardType.GRID}>
            <Card.Section>
              <Card.Content title={<Title variant={TitleVariant.TITLE_3}>Personal Info</Title>}>
                <Grid.Root>
                  <Grid.Item xs={12} md={6}>
                    <TextInput
                      label="First Name"
                      required
                      state={errors.firstName ? FormControlState.ERROR : undefined}
                      subText={errors.firstName}
                    />
                  </Grid.Item>
                  <Grid.Item xs={12} md={6}>
                    <TextInput label="Last Name" required />
                  </Grid.Item>
                  <Grid.Item xs={12}>
                    <TextInput label="Email" type="email" required />
                  </Grid.Item>
                  <Grid.Item xs={12} md={6}>
                    <DatePicker label="Date of Birth" />
                  </Grid.Item>
                  <Grid.Item xs={12} md={6}>
                    <Select label="Country">
                      <Select.Option value="us">United States</Select.Option>
                      <Select.Option value="fr">France</Select.Option>
                    </Select>
                  </Grid.Item>
                  <Grid.Item xs={12}>
                    <TextArea label="Bio" placeholder="Tell us about yourself" rows={4} />
                  </Grid.Item>
                </Grid.Root>
              </Card.Content>
            </Card.Section>
          </Card>
        )}

        {step === 1 && (
          <Card type={CardType.GRID}>
            <Card.Section>
              <Card.Content title={<Title variant={TitleVariant.TITLE_3}>Preferences</Title>}>
                <RadioGroup title="Communication preference" onChange={() => {}}>
                  <Radio label="Email" value="email" />
                  <Radio label="Phone" value="phone" />
                  <Radio label="SMS" value="sms" />
                </RadioGroup>
                <Divider />
                <Switch label="Enable notifications" />
                <Switch label="Subscribe to newsletter" />
                <Divider />
                <FileUploader label="Profile picture" accept=".jpg,.png" />
              </Card.Content>
            </Card.Section>
          </Card>
        )}

        <Flex justify="between" gap="md">
          {step > 0 && (
            <Button variant={ButtonVariant.SECONDARY} label="Back" onClick={() => setStep(step - 1)} />
          )}
          <Button
            variant={ButtonVariant.PRIMARY}
            label={step === 2 ? "Submit" : "Next"}
            onClick={() => step < 2 ? setStep(step + 1) : handleSubmit()}
          />
        </Flex>
      </Container>
      <Toast />
    </ThemeProvider>
  );
};
```

---

## Product Listing

Grid of filterable cards.

```tsx
import {
  ThemeProvider, AppTheme,
  Container, Grid, Flex,
  Card, CardType, CardGroup,
  Title, TitleVariant, Typography, TypographyVariant,
  Button, ButtonVariant, Link,
  SearchInput, ChipFilter, ChipSelect,
  Image, Pagination, Toast,
} from "@sanofi-accelerator/elements";

const ProductListing = () => (
  <ThemeProvider appTheme={AppTheme.SANOFI}>
    <Container>
      <Title variant={TitleVariant.TITLE_1}>Products</Title>

      {/* Search and filters */}
      <Flex direction="row" gap="md" align="center" wrap="wrap">
        <SearchInput placeholder="Search products..." onSearch={handleSearch} />
        <ChipSelect>All</ChipSelect>
        <ChipSelect>Category A</ChipSelect>
        <ChipSelect>Category B</ChipSelect>
      </Flex>

      {/* Active filters */}
      <Flex gap="xs" wrap="wrap">
        <ChipFilter onDelete={() => {}}>Price: $10-$50</ChipFilter>
        <ChipFilter onDelete={() => {}}>In Stock</ChipFilter>
      </Flex>

      {/* Product grid */}
      <Grid.Root>
        {products.map((product) => (
          <Grid.Item key={product.id} xs={12} sm={6} lg={4}>
            <Card type={CardType.GRID}>
              <Card.Section>
                <Card.Media>
                  <Image src={product.image} alt={product.name} />
                </Card.Media>
                <Card.Content
                  category={product.category}
                  title={<Title variant={TitleVariant.TITLE_3}>{product.name}</Title>}
                  subText={product.description}
                >
                  <Link href={`/products/${product.id}`}>View details</Link>
                </Card.Content>
              </Card.Section>
              <Card.Section>
                <Card.Action>
                  <Button variant={ButtonVariant.PRIMARY} label="Add to Cart" />
                </Card.Action>
              </Card.Section>
            </Card>
          </Grid.Item>
        ))}
      </Grid.Root>

      <Pagination currentPage={1} totalPages={10} onPageChange={setPage} />
    </Container>
    <Toast />
  </ThemeProvider>
);
```

---

## Settings Page

Tabs with grouped settings.

```tsx
import {
  ThemeProvider, AppTheme,
  Container, Flex, Grid,
  Title, TitleVariant, Typography, TypographyVariant,
  Tabs, Card, CardType, Divider,
  TextInput, Select, Switch, SwitchGroup,
  Button, ButtonVariant, Avatar, Toast,
} from "@sanofi-accelerator/elements";

const SettingsPage = () => (
  <ThemeProvider appTheme={AppTheme.INTERNAL_TOOLS}>
    <Container>
      <Title variant={TitleVariant.TITLE_1}>Settings</Title>

      <Tabs defaultSelected="profile">
        <Tabs.List>
          <Tabs.Tab name="profile">Profile</Tabs.Tab>
          <Tabs.Tab name="notifications">Notifications</Tabs.Tab>
          <Tabs.Tab name="security">Security</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel name="profile">
          <Card type={CardType.GRID}>
            <Card.Section>
              <Card.Content title={<Title variant={TitleVariant.TITLE_3}>Profile</Title>}>
                <Flex gap="lg" align="center">
                  <Avatar src="/avatar.jpg" alt="Profile" />
                  <Button variant={ButtonVariant.SECONDARY} label="Change Photo" />
                </Flex>
                <Divider />
                <Grid.Root>
                  <Grid.Item xs={12} md={6}>
                    <TextInput label="First Name" defaultValue="Jane" />
                  </Grid.Item>
                  <Grid.Item xs={12} md={6}>
                    <TextInput label="Last Name" defaultValue="Doe" />
                  </Grid.Item>
                  <Grid.Item xs={12}>
                    <TextInput label="Email" defaultValue="jane@example.com" />
                  </Grid.Item>
                </Grid.Root>
                <Flex justify="end" gap="md">
                  <Button variant={ButtonVariant.SECONDARY} label="Cancel" />
                  <Button variant={ButtonVariant.PRIMARY} label="Save" />
                </Flex>
              </Card.Content>
            </Card.Section>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel name="notifications">
          <Card type={CardType.GRID}>
            <Card.Section>
              <Card.Content title={<Title variant={TitleVariant.TITLE_3}>Notifications</Title>}>
                <SwitchGroup title="Email Notifications">
                  <Switch label="Marketing emails" />
                  <Switch label="Product updates" />
                  <Switch label="Security alerts" defaultChecked />
                </SwitchGroup>
                <Divider />
                <SwitchGroup title="Push Notifications">
                  <Switch label="New messages" defaultChecked />
                  <Switch label="Reminders" />
                </SwitchGroup>
              </Card.Content>
            </Card.Section>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Container>
    <Toast />
  </ThemeProvider>
);
```

---

## Detail Page

Breadcrumb + content with related items.

```tsx
import {
  ThemeProvider, AppTheme,
  Container, Grid, Flex,
  Breadcrumb, Title, TitleVariant,
  Typography, TypographyVariant, TypographyColor,
  Image, Button, ButtonVariant,
  Card, CardType, Divider, Accordion,
  ChipStatus, Tabs, Carousel, Toast,
} from "@sanofi-accelerator/elements";

const DetailPage = () => (
  <ThemeProvider appTheme={AppTheme.SANOFI}>
    <Container>
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
        <Breadcrumb.Item aria-current="page">Product Name</Breadcrumb.Item>
      </Breadcrumb>

      <Grid.Root>
        {/* Media */}
        <Grid.Item xs={12} md={6}>
          <Carousel>
            <Carousel.Slide><Image src="/photo1.jpg" alt="Product view 1" /></Carousel.Slide>
            <Carousel.Slide><Image src="/photo2.jpg" alt="Product view 2" /></Carousel.Slide>
          </Carousel>
        </Grid.Item>

        {/* Info */}
        <Grid.Item xs={12} md={6}>
          <Flex direction="column" gap="md">
            <ChipStatus>In Stock</ChipStatus>
            <Title variant={TitleVariant.TITLE_1}>Product Name</Title>
            <Typography variant={TypographyVariant.BODY_LARGE}>
              Product description goes here with all the important details.
            </Typography>
            <Typography variant={TypographyVariant.BODY_MEDIUM} color={TypographyColor.SUBTLE}>
              Category: Electronics
            </Typography>
            <Divider />
            <Flex gap="md">
              <Button variant={ButtonVariant.PRIMARY} label="Add to Cart" fullWidth />
              <Button variant={ButtonVariant.SECONDARY} label="Save" />
            </Flex>
          </Flex>
        </Grid.Item>
      </Grid.Root>

      {/* Details accordion */}
      <Accordion>
        <Accordion.Item>
          <Accordion.Header>Specifications</Accordion.Header>
          <Accordion.Panel>
            <Typography variant={TypographyVariant.BODY_MEDIUM}>Specs content</Typography>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>Reviews</Accordion.Header>
          <Accordion.Panel>
            <Typography variant={TypographyVariant.BODY_MEDIUM}>Reviews content</Typography>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Related items */}
      <Title variant={TitleVariant.TITLE_2}>Related Products</Title>
      <Grid.Root>
        {relatedProducts.map((item) => (
          <Grid.Item key={item.id} xs={12} sm={6} lg={3}>
            <Card type={CardType.GRID}>
              <Card.Section>
                <Card.Media><Image src={item.image} alt={item.name} /></Card.Media>
                <Card.Content
                  title={<Title variant={TitleVariant.TITLE_4}>{item.name}</Title>}
                  subText={item.description}
                />
              </Card.Section>
            </Card>
          </Grid.Item>
        ))}
      </Grid.Root>
    </Container>
    <Toast />
  </ThemeProvider>
);
```
