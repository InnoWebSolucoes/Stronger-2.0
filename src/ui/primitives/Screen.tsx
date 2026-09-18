import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, space, type } from '@/ui/tokens.bridge';

/**
 * Standard screen frame: safe-area aware, large title, optional trailing
 * action. Every tab uses this so the headers are pixel-identical rather than
 * each screen re-inventing its own spacing.
 */
export function Screen({
  title,
  subtitle,
  action,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <Body
        style={styles.body}
        {...(scroll
          ? {
              contentContainerStyle: styles.bodyContent,
              showsVerticalScrollIndicator: false,
            }
          : {})}
      >
        {children}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.app },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
  headerText: { flex: 1 },
  title: { ...type.display, color: c.fg.primary },
  subtitle: { ...type.body, color: c.fg.tertiary, marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: space.xl, paddingBottom: space['4xl'] },
});
