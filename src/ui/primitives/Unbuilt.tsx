import { StyleSheet, Text, View } from 'react-native';
import { c, radius, space, type } from '@/ui/tokens.bridge';

/**
 * Honest placeholder for a screen that genuinely is not built yet.
 *
 * Deliberately not a fake UI full of lorem data: a mocked-up screen that looks
 * finished is how a project loses track of what actually works. This states
 * what is coming and what it depends on, and it should be deleted — not
 * restyled — when the real screen lands.
 */
export function Unbuilt({ what, dependsOn }: { what: string; dependsOn?: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>NOT BUILT YET</Text>
      </View>
      <Text style={styles.what}>{what}</Text>
      {dependsOn ? <Text style={styles.depends}>Waiting on {dependsOn}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: space['2xl'],
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.default,
    borderStyle: 'dashed',
    backgroundColor: c.surface[1],
    gap: space.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
  },
  badgeText: { ...type.overline, color: c.fg.tertiary },
  what: { ...type.body, color: c.fg.secondary },
  depends: { ...type.caption, color: c.fg.tertiary },
});
