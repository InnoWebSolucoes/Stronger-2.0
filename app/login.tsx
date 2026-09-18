import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dumbbell, Sparkles } from 'lucide-react-native';
import { DEMO_PROFILE, useAccount, type Profile } from '@/features/account/store';
import { useBodyweight } from '@/features/bodyweight/store';
import { useWorkout } from '@/features/workout/store';
import { generateDemoData } from '@/features/demo/generate';
import { c, radius, space, type } from '@/ui/tokens.bridge';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAccount((s) => s.signIn);
  const replaceHistory = useWorkout((s) => s.replaceHistory);
  const replaceWeight = useBodyweight((s) => s.replaceAll);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const enterDemo = async () => {
    setBusy(true);
    const now = Date.now();
    const { workouts, bodyweight } = generateDemoData(now, 34, DEMO_PROFILE.bodyweightKg);

    replaceHistory(workouts);
    replaceWeight(
      bodyweight.map((b, i) => ({ id: `bw_demo_${i}`, date: b.date, kg: b.kg })),
    );
    signIn(DEMO_PROFILE);
    setBusy(false);
    router.replace('/');
  };

  const enterFresh = () => {
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const initials =
      parts.length >= 2
        ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
        : (trimmed.slice(0, 2) || 'ST').toUpperCase();

    const profile: Profile = {
      ...DEMO_PROFILE,
      id: `local_${Date.now().toString(36)}`,
      name: trimmed || 'Lifter',
      handle: (trimmed.toLowerCase().replace(/[^a-z0-9]/g, '') || 'lifter').slice(0, 18),
      bio: undefined,
      initials,
      isPro: false,
      joinedAt: Date.now(),
      followers: 0,
      following: 0,
    };

    replaceHistory([]);
    replaceWeight([]);
    signIn(profile);
    router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['3xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Dumbbell color={c.bg.canvas} size={26} />
          </View>
          <Text style={styles.wordmark}>Stronger</Text>
          <Text style={styles.tagline}>
            Log every set. See where you actually stand.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Try the demo</Text>
          <Text style={styles.cardBody}>
            Eight months of training history, bodyweight tracking and personal
            records — so every screen has real data in it.
          </Text>
          <Pressable style={styles.primary} onPress={enterDemo} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={c.bg.canvas} />
            ) : (
              <>
                <Sparkles color={c.bg.canvas} size={16} />
                <Text style={styles.primaryText}>Open demo profile</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>OR START CLEAN</Text>
          <View style={styles.rule} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your own log</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={c.fg.disabled}
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={enterFresh}
          />
          <Pressable style={styles.secondary} onPress={enterFresh}>
            <Text style={styles.secondaryText}>Start with an empty log</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Everything stays on this device. There is no account and nothing is
          uploaded — cloud sync arrives with the Supabase backend.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.app },
  content: { padding: space.xl, gap: space.lg, flexGrow: 1, justifyContent: 'center' },

  brand: { alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: c.brand.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...type.display, color: c.fg.primary },
  tagline: { ...type.body, color: c.fg.tertiary, textAlign: 'center' },

  card: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.xl,
    gap: space.md,
  },
  cardTitle: { ...type.heading, color: c.fg.primary },
  cardBody: { ...type.body, color: c.fg.secondary },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.brand.base,
  },
  primaryText: { ...type.heading, color: c.bg.canvas },

  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: c.surface[3],
    color: c.fg.primary,
    paddingHorizontal: space.lg,
    fontSize: 16,
  },
  secondary: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...type.bodyStrong, color: c.fg.primary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: c.border.subtle },
  dividerText: { ...type.overline, color: c.fg.tertiary },

  footnote: { ...type.caption, color: c.fg.tertiary, textAlign: 'center' },
});
