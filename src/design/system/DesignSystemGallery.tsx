import React, {useState} from 'react';
import {
  AccessibilityInfo,
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {Bell, Check, Flame, TrendingUp, X} from 'lucide-react-native';
import {BrandMark} from '../components/BrandMark';
import {getBrandIcon} from '../brand/usage';
import {DesignSystemProvider, useSystemTheme} from './theme';
import {
  layout,
  palette,
  space,
  systemVersion,
  typography,
  type SystemScheme,
  type TextVariant,
} from './tokens';
import {
  DSAvatar,
  DSButton,
  DSFeedback,
  DSIconButton,
  DSInput,
  DSListRow,
  DSProgress,
  DSScreen,
  DSSectionHeading,
  DSStatistics,
  DSStatus,
  DSSurface,
  DSText,
} from './primitives';
import {DSActivityPreview, DSCommitmentPreview} from './recipes';

const pages = ['Foundations', 'Controls', 'Patterns', 'States'] as const;
type GalleryPage = (typeof pages)[number];

export function DesignSystemGallery({onClose}: {onClose?: () => void}) {
  const [scheme, setScheme] = useState<SystemScheme>('light');
  return (
    <DesignSystemProvider scheme={scheme}>
      <GalleryContent scheme={scheme} setScheme={setScheme} onClose={onClose} />
    </DesignSystemProvider>
  );
}

function GalleryContent({
  scheme,
  setScheme,
  onClose,
}: {
  scheme: SystemScheme;
  setScheme: (value: SystemScheme) => void;
  onClose?: () => void;
}) {
  const theme = useSystemTheme();
  const {width, fontScale} = useWindowDimensions();
  const [page, setPage] = useState<GalleryPage>('Foundations');
  const [longContent, setLongContent] = useState(false);
  const [narrowPreview, setNarrowPreview] = useState(false);
  const [announcement, setAnnouncement] = useState(
    'Local fixtures only. No account data or requests.',
  );
  const announce = (message: string) => {
    setAnnouncement(message);
    AccessibilityInfo.announceForAccessibility(message);
  };
  return (
    <DSScreen
      key={`${page}:${narrowPreview}:${fontScale}`}
      testID="design-system-gallery"
      style={narrowPreview ? styles.narrowPreview : undefined}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.canvas}
      />
      <View style={styles.header}>
        <BrandMark kind="logo" isDark={theme.isDark} style={styles.logo} />
        {onClose ? (
          <DSIconButton
            label="Close design system gallery"
            onPress={onClose}
            icon={<X size={20} color={theme.text} />}
          />
        ) : null}
      </View>
      <DSText variant="screenTitle">Design system</DSText>
      <DSText variant="secondary" tone="muted">
        v{systemVersion} ·{' '}
        {Math.round(narrowPreview ? Math.min(width, 360) : width)} pt/dp
        {narrowPreview ? ' preview' : ''} · text scale {fontScale.toFixed(2)}
      </DSText>
      <View style={styles.controls}>
        <DSButton
          label={scheme === 'light' ? 'Show dark' : 'Show light'}
          variant="outline"
          compact
          onPress={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
        />
        <DSButton
          label={longContent ? 'Short content' : 'Long content'}
          variant="quiet"
          compact
          onPress={() => setLongContent(!longContent)}
        />
        <DSButton
          label={narrowPreview ? 'Full width' : '360 width'}
          variant="quiet"
          compact
          onPress={() => setNarrowPreview(!narrowPreview)}
        />
      </View>
      <View style={styles.controls}>
        {pages.map(value => (
          <DSButton
            key={value}
            label={value}
            compact
            accessibilityState={{selected: value === page}}
            variant={value === page ? 'primary' : 'quiet'}
            onPress={() => setPage(value)}
          />
        ))}
      </View>
      <DSText
        variant="secondary"
        tone="muted"
        accessibilityLiveRegion="polite"
        testID="gallery-announcement">
        {announcement}
      </DSText>
      {page === 'Foundations' ? (
        <Foundations />
      ) : page === 'Controls' ? (
        <Controls longContent={longContent} announce={announce} />
      ) : page === 'Patterns' ? (
        <Patterns longContent={longContent} announce={announce} />
      ) : (
        <States announce={announce} />
      )}
      <DSText variant="secondary" tone="muted">
        End of {page.toLowerCase()}. Home and the production tab bar are frozen
        references.
      </DSText>
    </DSScreen>
  );
}

function Foundations() {
  const theme = useSystemTheme();
  return (
    <>
      <DSSectionHeading
        title="Typography"
        subtitle="Native system font. Regular body, semibold hierarchy."
      />
      {(Object.keys(typography) as TextVariant[]).map(variant => (
        <View key={variant} style={styles.sample}>
          <DSText variant={variant}>
            {variant}: Make room for what matters
          </DSText>
          <DSText variant="secondary" tone="muted">
            {typography[variant].fontSize}/{typography[variant].lineHeight} ·{' '}
            {typography[variant].fontWeight}
          </DSText>
        </View>
      ))}
      <DSSectionHeading
        title="Semantic colors"
        subtitle="Saturated marks and readable text have separate roles."
      />
      {(
        [
          'canvas',
          'surface',
          'mutedSurface',
          'text',
          'muted',
          'action',
          'progress',
          'success',
          'warning',
          'danger',
        ] as const
      ).map(key => (
        <View key={key} style={styles.swatchRow}>
          <View
            style={[
              styles.swatch,
              {backgroundColor: theme[key], borderColor: theme.border},
            ]}
          />
          <DSText>{key}</DSText>
          <DSText variant="secondary" tone="muted">
            {theme[key]}
          </DSText>
        </View>
      ))}
      <DSSectionHeading title="Category surfaces" />
      {(Object.keys(theme.category) as (keyof typeof theme.category)[]).map(
        category => (
          <DSSurface key={category} category={category}>
            <DSText style={{color: theme.category[category].foreground}}>
              {category} · existing category meaning
            </DSText>
          </DSSurface>
        ),
      )}
      <DSSectionHeading
        title="Spacing and surfaces"
        subtitle="22 page gutter · 16 section gap · 12 card padding · 4 supporting gap"
      />
      <DSSurface kind="message" raised>
        <DSText variant="message">
          <DSText variant="message" style={styles.bold}>
            Alex, your commitment
          </DSText>{' '}
          is ready for today's Tap In.
        </DSText>
      </DSSurface>
      <DSSurface>
        <DSText>Plain surface for grouped content.</DSText>
      </DSSurface>
      <DSSurface kind="quiet">
        <DSText>Quiet support, without elevation.</DSText>
      </DSSurface>
    </>
  );
}

function Controls({
  longContent,
  announce,
}: {
  longContent: boolean;
  announce: (message: string) => void;
}) {
  const theme = useSystemTheme();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <DSSectionHeading
        title="Actions"
        subtitle="Visible compact pills retain full touch targets."
      />
      <DSButton
        label={
          longContent
            ? 'Save this commitment and return to the circle'
            : 'Save commitment'
        }
        onPress={() => {
          setError(!name.trim());
          announce(
            name.trim()
              ? 'Saved locally in the gallery.'
              : 'Enter a commitment name.',
          );
        }}
      />
      <View style={styles.controls}>
        <DSButton
          label="Tap In"
          variant="outline"
          compact
          onPress={() =>
            announce('Direct action pressed. The row did not open.')
          }
        />
        <DSButton label="Unavailable" disabled compact />
        <DSIconButton
          label="Example notifications"
          icon={<Bell size={20} color={theme.text} />}
          onPress={() =>
            announce('Notification example pressed. No Inbox was opened.')
          }
        />
      </View>
      <DSButton
        label="Delete example"
        variant="danger"
        onPress={() =>
          announce('Destructive styling example. Nothing was deleted.')
        }
      />
      <DSButton
        label="Save example"
        busy={busy}
        onPress={() => setBusy(true)}
      />
      {busy ? (
        <DSButton
          label="Resolve simulated request"
          variant="quiet"
          onPress={() => {
            setBusy(false);
            announce('Simulated save finished.');
          }}
        />
      ) : null}
      <DSSectionHeading
        title="Inputs"
        subtitle="Labels stay visible, errors explain what to fix."
      />
      <DSInput
        label="Commitment name"
        value={name}
        onChangeText={value => {
          setName(value);
          setError(false);
        }}
        placeholder="Read every day"
        error={error ? 'Enter a commitment name.' : undefined}
        hint="Choose a name you will recognize."
      />
      <DSInput
        label="Notes"
        multiline
        value={note}
        onChangeText={setNote}
        placeholder={
          longContent
            ? 'Add context about what you want to practice and how you will recognize progress over the coming weeks.'
            : 'Add optional context'
        }
      />
      <DSInput
        label="Read-only example"
        value="Pending membership"
        editable={false}
      />
      <DSSectionHeading title="Rows and avatars" />
      <DSListRow
        title={
          longContent
            ? 'An intentionally long commitment title that wraps naturally without hiding its action'
            : 'Daily reading'
        }
        subtitle="Needs your Tap In"
        leading={<DSAvatar name="Alex" />}
        onPress={() => announce('Row opened. No Tap In was submitted.')}
        action={
          <DSButton
            label="Tap In"
            compact
            variant="outline"
            onPress={() => announce('Tap In pressed. The row did not open.')}
          />
        }
      />
      <DSListRow
        title="All my commitments"
        leading={
          <View
            style={[styles.backplate, {backgroundColor: theme.mutedSurface}]}>
            <Check size={16} color={theme.muted} />
          </View>
        }
        onPress={() => announce('All commitments example opened.')}
      />
      <View style={styles.controls}>
        <DSAvatar
          name="Local brand placeholder"
          source={getBrandIcon(theme.isDark)}
          size={32}
          accessibilityLabel="Local image, fills its circular crop"
        />
        <DSAvatar
          name="Alex"
          size={32}
          accessibilityLabel="Alex, initials fallback"
        />
        <DSStatus
          label="Complete"
          tone="success"
          icon={<Check size={16} color={theme.success} />}
        />
        <DSStatus label="Pending approval" />
      </View>
    </>
  );
}

function Patterns({
  longContent,
  announce,
}: {
  longContent: boolean;
  announce: (message: string) => void;
}) {
  const theme = useSystemTheme();
  const [focus, setFocus] = useState<string | undefined>('Read every day');
  const [done, setDone] = useState(false);
  const [nudged, setNudged] = useState(false);
  return (
    <>
      <DSSectionHeading title="Statistics" />
      <DSStatistics
        onPress={() => announce('Momentum navigation example.')}
        items={[
          {
            label: 'Current streak',
            value: longContent ? '128 days' : '7 days',
            tone: 'warning',
            icon: <Flame size={16} color={theme.warning} />,
          },
          {
            label: '14-day momentum',
            value: '64%',
            tone: 'progress',
            icon: <TrendingUp size={16} color={theme.progress} />,
          },
        ]}
      />
      <View style={styles.sample}>
        <DSSectionHeading title="Your commitments" />
        <DSProgress
          completed={Number(done) + Number(nudged)}
          total={2}
          label={
            done && nudged
              ? 'All actions complete'
              : `${Number(!done) + Number(!nudged)} ${
                  done || nudged ? 'action' : 'actions'
                } needed today`
          }
        />
      </View>
      <DSCommitmentPreview
        title="Read every day"
        category="Deep Work"
        expanded={focus === 'Read every day'}
        members={[
          {id: 'alex', name: 'Alex'},
          {id: 'sam', name: 'Sam', source: getBrandIcon(theme.isDark)},
        ]}
        description={
          longContent
            ? 'Read a chapter each evening and write a few sentences about something you want to remember or put into practice tomorrow.'
            : 'Read one chapter and write a short note.'
        }
        context="1 of 3 members tapped in"
        status={
          done && nudged
            ? 'Tap In and Nudge handled'
            : done
            ? '2 members need a nudge'
            : 'Needs your Tap In'
        }
        onExpand={() => setFocus('Read every day')}
        onDetails={() => announce('Read every day details example.')}
        action={
          done && nudged
            ? undefined
            : {
                label: done ? 'Nudge' : 'Tap In',
                onPress: () => {
                  if (done) {
                    setNudged(true);
                    setFocus(undefined);
                    announce('Simulated Nudge completed.');
                  } else {
                    setDone(true);
                    announce('Simulated Tap In saved. Nudge is now available.');
                  }
                },
              }
        }
      />
      <DSCommitmentPreview
        title="Walk outside"
        category="Fitness"
        expanded={focus === 'Walk outside'}
        status="Tapped in today"
        description="Take a walk during lunch."
        context="Personal commitment"
        onExpand={() => setFocus('Walk outside')}
        onDetails={() => announce('Walk outside details example.')}
      />
      <DSCommitmentPreview
        title="Write together"
        category="Writing"
        expanded={focus === 'Write together'}
        status="Pending approval"
        description="Write one page each morning."
        context="Membership awaiting approval"
        onExpand={() => setFocus('Write together')}
        onDetails={() => announce('Pending membership details example.')}
      />
      <DSButton
        label="Reset local actions"
        variant="quiet"
        onPress={() => {
          setDone(false);
          setNudged(false);
          setFocus('Read every day');
        }}
      />
      <DSSectionHeading title="Circle activity" />
      <DSActivityPreview
        name="Alex"
        message={
          longContent
            ? 'Alex tapped in for Read a chapter and write a reflection each evening'
            : 'Alex tapped in for Daily reading'
        }
        timestamp="2 hours ago"
        onPress={() =>
          announce('Activity details example. No read receipt was sent.')
        }
      />
      <DSActivityPreview
        name="Sam"
        avatar={getBrandIcon(theme.isDark)}
        message="Sam shared a photo"
        timestamp="Yesterday"
        media={
          <Image
            source={getBrandIcon(theme.isDark)}
            style={styles.thumbnail}
            accessible={false}
          />
        }
        onPress={() => announce('Activity media example opened.')}
      />
    </>
  );
}

function States({announce}: {announce: (message: string) => void}) {
  const [failed, setFailed] = useState(true);
  return (
    <>
      <DSFeedback
        kind="loading"
        title="Loading commitments"
        message="Use neutral content until real data is available."
      />
      <DSFeedback
        kind={failed ? 'error' : 'success'}
        title={failed ? 'Could not load commitments' : 'Example loaded'}
        message={
          failed
            ? 'Your existing progress has not changed.'
            : 'Retry resolved a local fixture only.'
        }
        action={
          failed ? (
            <DSButton
              label="Retry"
              variant="outline"
              onPress={() => {
                setFailed(false);
                announce('Retry succeeded locally.');
              }}
            />
          ) : undefined
        }
      />
      <DSFeedback
        title="No commitments yet"
        message="Find a circle or start a commitment."
        action={
          <DSButton
            label="Find circles"
            onPress={() => announce('Discovery example opened.')}
          />
        }
      />
      <DSFeedback
        title="Complete your profile"
        message="Finish your profile before taking part."
        action={
          <DSButton
            label="Complete profile"
            onPress={() => announce('Profile example opened.')}
          />
        }
      />
      <DSFeedback
        title="Start your commitment"
        message="Guest presentation uses discovery copy, without invented personal progress."
        action={
          <DSButton
            label="Get started"
            onPress={() => announce('Guest entry example opened.')}
          />
        }
      />
      <DSProgress total={0} completed={0} label="No actions needed today" />
      <DSProgress total={4} completed={1} label="1 of 4 actions complete" />
      <DSProgress total={4} completed={4} label="All actions complete" />
      <DSStatus label="Pending approval, excluded from daily actions" />
      <DSFeedback
        title="No circle activity yet"
        message="Activity will appear when members take part."
      />
      <DSSurface kind="quiet">
        <DSText>Refreshing keeps the last resolved content visible.</DSText>
        <DSStatus label="Updating…" />
      </DSSurface>
    </>
  );
}

const styles = StyleSheet.create({
  narrowPreview: {width: '100%', maxWidth: 360, alignSelf: 'center'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {width: 92, height: 44},
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  sample: {gap: space.xs},
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flexWrap: 'wrap',
  },
  swatch: {width: 32, height: 32, borderRadius: 8, borderWidth: 1},
  bold: {fontWeight: '700'},
  backplate: {
    width: layout.iconBackplate,
    height: layout.iconBackplate,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: palette.blue,
  },
});
