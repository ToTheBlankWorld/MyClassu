import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, CalendarDays, Check, Play, Trash2 } from 'lucide-react-native';
import {
  Badge,
  Button,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ProgressIndicator,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  useToast,
} from '../../components';
import {
  AnimatedPressable,
  Entrance,
  haptics,
  usePressScale,
  useTheme,
  useThemePreference,
  type ThemePreference,
} from '../../design';
import type { RootStackParamList } from '../../navigation/types';

type ShowcaseScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DesignSystem'
>;

const COLOR_ROLES = [
  'background',
  'surface',
  'surfaceRaised',
  'surfaceSunken',
  'border',
  'accent',
  'success',
  'warning',
  'danger',
  'textPrimary',
  'textSecondary',
  'textMuted',
] as const;

const TYPOGRAPHY_VARIANTS = [
  'display',
  'headingLarge',
  'heading',
  'title',
  'body',
  'bodySmall',
  'label',
  'caption',
  'metadata',
] as const;

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Temporary Stage 2 verification screen — not a product screen. */
export function DesignSystemShowcaseScreen({
  navigation,
}: ShowcaseScreenProps) {
  const theme = useTheme();
  const spacing = theme.spacing;

  return (
    <Screen safeEdges="all" padded={false}>
      <Stack style={{ paddingTop: 0, flex: 1 }}>
        <Row
          justify="between"
          align="center"
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
        >
          <Stack>
            <Text variant="metadata" color="muted">
              STAGE 2 · VERIFICATION
            </Text>
            <Text variant="heading">Design system</Text>
          </Stack>
          <IconButton
            glyph={Check}
            label="Close showcase"
            tone="accent"
            onPress={() => navigation.goBack()}
          />
        </Row>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.xxl }}
        >
          <ThemeSection />
          <TypographySection />
          <ColorSection />
          <SurfaceSection />
          <ButtonSection />
          <IconButtonSection />
          <BadgeChipSection />
          <ProgressSection />
          <ToastSection />
          <LoadingSection />
          <EmptyErrorSection />
          <MotionSection />
          <HapticsSection />
          <Text variant="caption" color="muted" align="center">
            MyClassu design system · {theme.isDark ? 'dark' : 'light'} theme
          </Text>
        </ScrollView>
      </Stack>
    </Screen>
  );
}

function ThemeSection() {
  const { preference, setPreference } = useThemePreference();
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Theme" />
      <Row gap="sm">
        {THEME_OPTIONS.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            selected={preference === option.value}
            onPress={() => setPreference(option.value as ThemePreference)}
          />
        ))}
      </Row>
      <Text variant="caption" color="muted">
        Every token on this screen resolves through the active theme. Surfaces
        stack; dark mode is layered, not black.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function TypographySection() {
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Typography" />
      <Stack gap="sm">
        {TYPOGRAPHY_VARIANTS.map(variant => (
          <Stack key={variant} gap={0}>
            <Text variant="metadata" color="muted">
              {variant}
            </Text>
            <Text variant={variant}>The quick class reminder</Text>
          </Stack>
        ))}
      </Stack>
      <Divider inset={spacing.sm} />
    </Stack>
  );
}

function ColorSection() {
  const { colors, spacing, radius } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Color roles" />
      <Row gap="md" style={{ flexWrap: 'wrap' }}>
        {COLOR_ROLES.map(role => (
          <Stack key={role} gap={0} align="center" style={{ width: 88 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: colors[role],
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <Text variant="metadata" color="muted" align="center">
              {role}
            </Text>
          </Stack>
        ))}
      </Row>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function SurfaceSection() {
  const { spacing, elevation } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Surfaces" />
      <Stack gap="sm">
        <Surface level="base" style={{ padding: spacing.lg }}>
          <Text variant="bodySmall">Surface · base (cards, content)</Text>
        </Surface>
        <Surface level="raised" style={{ padding: spacing.lg }}>
          <Text variant="bodySmall">Raised · floats (toasts, menus)</Text>
        </Surface>
        <Surface
          level="sunken"
          bordered={false}
          style={{ padding: spacing.lg }}
        >
          <Text variant="bodySmall">Sunken · wells and tracks</Text>
        </Surface>
        <Surface
          bordered={false}
          style={[{ padding: spacing.lg }, elevation.level2]}
        >
          <Text variant="bodySmall">
            Elevation · used sparingly, never decoratively
          </Text>
        </Surface>
      </Stack>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function ButtonSection() {
  const [busy, setBusy] = useState(false);
  const { spacing } = useTheme();

  const runFakeTask = () => {
    setBusy(true);
    setTimeout(() => setBusy(false), 1500);
  };

  return (
    <Stack gap="md">
      <SectionHeader title="Buttons" />
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        <Button onPress={() => undefined}>Primary</Button>
        <Button variant="secondary" onPress={() => undefined}>
          Secondary
        </Button>
        <Button variant="tertiary" onPress={() => undefined}>
          Tertiary
        </Button>
        <Button variant="destructive" onPress={() => undefined}>
          Destructive
        </Button>
      </Row>
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        <Button size="sm" onPress={() => undefined}>
          Small
        </Button>
        <Button size="sm" variant="secondary" onPress={() => undefined}>
          Small secondary
        </Button>
        <Button size="sm" variant="tertiary" onPress={() => undefined}>
          Small tertiary
        </Button>
      </Row>
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        <Button loading={busy} onPress={runFakeTask}>
          {busy ? 'Working' : 'Press for loading'}
        </Button>
        <Button disabled onPress={() => undefined}>
          Disabled
        </Button>
      </Row>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function IconButtonSection() {
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Icon buttons" />
      <Row gap="sm" align="center">
        <IconButton
          glyph={Bell}
          label="Default tone"
          onPress={() => undefined}
        />
        <IconButton
          glyph={Play}
          label="Accent tone"
          tone="accent"
          onPress={() => undefined}
        />
        <IconButton
          glyph={Trash2}
          label="Destructive tone"
          tone="destructive"
          onPress={() => undefined}
        />
        <IconButton
          glyph={Bell}
          label="Small size"
          size="sm"
          onPress={() => undefined}
        />
        <IconButton
          glyph={Bell}
          label="Disabled"
          disabled
          onPress={() => undefined}
        />
      </Row>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function BadgeChipSection() {
  const [selected, setSelected] = useState('Study');
  const { spacing } = useTheme();

  const options = ['Study', 'Work', 'Personal', 'Health'];

  return (
    <Stack gap="md">
      <SectionHeader title="Badges & chips" />
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        <Badge>Default</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
      </Row>
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        {options.map(option => (
          <Chip
            key={option}
            label={option}
            selected={selected === option}
            onPress={() => setSelected(option)}
          />
        ))}
      </Row>
      <Text variant="caption" color="muted">
        Chips use a selection haptic; the selected state is announced to screen
        readers.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function ProgressSection() {
  const [value, setValue] = useState(0.4);
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader
        title="Progress"
        action={
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setValue(current => (current + 0.2) % 1)}
          >
            Advance
          </Button>
        }
      />
      <ProgressIndicator value={value} accessibilityLabel="Demo progress" />
      <Text variant="caption" color="muted">
        Fill movement springs on the UI thread; value is exposed to screen
        readers.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function ToastSection() {
  const { showToast } = useToast();
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="In-app notifications" />
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => showToast({ title: 'Schedule saved', tone: 'info' })}
        >
          Info
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            showToast({
              title: 'Attendance recorded',
              message: 'Foundations of Project Management, 10:00.',
              tone: 'success',
            })
          }
        >
          Success
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            showToast({
              title: 'Battery optimization active',
              message: 'Reminders may be delayed on this device.',
              tone: 'warning',
            })
          }
        >
          Warning
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            showToast({
              title: 'Unable to sync',
              message: 'Your data is safe locally — we will retry later.',
              tone: 'error',
              action: { label: 'Retry', onPress: () => undefined },
            })
          }
        >
          Error + action
        </Button>
      </Row>
      <Text variant="caption" color="muted">
        Swipe horizontally to dismiss; taps on the action or the close button
        also dismiss. Announced politely to screen readers.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function LoadingSection() {
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Loading" />
      <Stack gap="sm">
        <Skeleton
          height={14}
          width="72%"
          accessibilityLabel="Loading course title"
        />
        <Skeleton
          height={14}
          width="48%"
          accessibilityLabel="Loading course detail"
        />
        <Skeleton
          height={64}
          radius="lg"
          accessibilityLabel="Loading session card"
        />
      </Stack>
      <LoadingState label="Loading your timetable" />
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function EmptyErrorSection() {
  const { showToast } = useToast();
  const { spacing } = useTheme();

  return (
    <Stack gap="md">
      <SectionHeader title="Empty & error" />
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        message="Empty states explain the moment and point to the next action."
      />
      <ErrorState
        title="Couldn't load the schedule"
        message="Check your connection — your timetable is stored on this device."
        onRetry={() => showToast({ title: 'Retried', tone: 'success' })}
      />
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function MotionSection() {
  const [runId, setRunId] = useState(0);
  const { spacing, radius, colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const { showToast } = useToast();

  return (
    <Stack gap="md">
      <SectionHeader
        title="Motion"
        action={
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setRunId(id => id + 1)}
          >
            Replay entrance
          </Button>
        }
      />
      <Stack key={runId} gap="sm">
        <Entrance delay={0}>
          <Surface level="base" style={{ padding: spacing.lg }}>
            <Text variant="bodySmall">Fade + rise, delay 0ms</Text>
          </Surface>
        </Entrance>
        <Entrance delay={70}>
          <Surface level="base" style={{ padding: spacing.lg }}>
            <Text variant="bodySmall">Fade + rise, delay 70ms</Text>
          </Surface>
        </Entrance>
        <Entrance delay={140}>
          <Surface level="base" style={{ padding: spacing.lg }}>
            <Text variant="bodySmall">Fade + rise, delay 140ms</Text>
          </Surface>
        </Entrance>
      </Stack>
      <AnimatedPressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => showToast({ title: 'Press feedback', tone: 'info' })}
        style={[
          {
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.accentTint,
          },
          animatedStyle,
        ]}
      >
        <Text variant="bodySmall" color="accent">
          Press me — spring scale (respecting reduced motion)
        </Text>
      </AnimatedPressable>
      <Text variant="caption" color="muted">
        Every animation here has a job: feedback, hierarchy, or continuity. With
        reduced motion enabled, entrances appear in place.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}

function HapticsSection() {
  const { spacing } = useTheme();

  const demos = [
    { label: 'Light', run: haptics.light },
    { label: 'Medium', run: haptics.medium },
    { label: 'Success', run: haptics.success },
    { label: 'Warning', run: haptics.warning },
    { label: 'Error', run: haptics.error },
    { label: 'Selection', run: haptics.selection },
  ];

  return (
    <Stack gap="md">
      <SectionHeader title="Haptics" />
      <Row gap="sm" style={{ flexWrap: 'wrap' }}>
        {demos.map(demo => (
          <Button
            key={demo.label}
            size="sm"
            variant="secondary"
            onPress={demo.run}
          >
            {demo.label}
          </Button>
        ))}
      </Row>
      <Text variant="caption" color="muted">
        Haptic calls are centralized and fail silently on unsupported devices.
      </Text>
      <View style={{ height: spacing.xs }} />
    </Stack>
  );
}
