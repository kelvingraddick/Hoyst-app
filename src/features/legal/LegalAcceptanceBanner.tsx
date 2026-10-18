import React, {useState} from 'react';
import {StyleSheet} from 'react-native';
import {DSButton, DSSurface, DSText, useSystemTheme} from '../../design/system';
import {useLegalAcceptance} from './LegalAcceptanceContext';
import {LegalAcknowledgment} from './LegalAcknowledgment';

export function LegalAcceptanceBanner() {
  const legal = useLegalAcceptance();
  if (!legal.uid || legal.accepted === true) return null;
  return <AccountAcknowledgment key={legal.uid} />;
}
function AccountAcknowledgment() {
  const legal = useLegalAcceptance();
  const theme = useSystemTheme();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await legal.acknowledge();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not save. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (legal.accepted === undefined && !legal.error) return null;
  return (
    <DSSurface
      kind="quiet"
      style={[styles.banner, {borderColor: theme.border}]}
      testID="legal-acceptance-inline">
      {legal.accepted === false ? (
        <>
          <LegalAcknowledgment
            compact
            checked={checked}
            onChange={setChecked}
            disabled={busy}
            action={
              <DSButton
                compact
                label={busy ? 'Saving...' : 'Confirm'}
                accessibilityLabel="Confirm age and agreement to the Terms"
                disabled={!checked || busy}
                onPress={() => void save()}
                labelStyle={styles.actionLabel}
                style={styles.action}
              />
            }
          />
        </>
      ) : null}
      {error || legal.error ? (
        <DSText variant="secondary" tone="danger" accessibilityRole="alert">
          {error || legal.error}
        </DSText>
      ) : null}
      {legal.error ? (
        <DSButton
          compact
          variant="quiet"
          label="Try again"
          onPress={legal.retry}
          style={styles.retry}
        />
      ) : null}
    </DSSurface>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  action: {marginLeft: 'auto', flexShrink: 1},
  actionLabel: {fontSize: 13, lineHeight: 18},
  retry: {alignSelf: 'flex-start'},
});
