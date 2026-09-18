import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useWorkout } from '@/features/workout/store';
import { useAccount } from '@/features/account/store';
import { useBodyweight } from '@/features/bodyweight/store';
import { useRoutines } from '@/features/routines/store';
import { DialogHost } from '@/ui/primitives/Dialog';
import { c } from '@/ui/tokens.bridge';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const hydrateWorkout = useWorkout((s) => s.hydrate);
  const hydrateAccount = useAccount((s) => s.hydrate);
  const hydrateWeight = useBodyweight((s) => s.hydrate);
  const hydrateRoutines = useRoutines((s) => s.hydrate);

  const accountHydrated = useAccount((s) => s.hydrated);
  const profile = useAccount((s) => s.profile);

  // Recover any in-progress workout before the first interaction. A session
  // surviving a force-kill is the core promise, so this runs at the root.
  useEffect(() => {
    void hydrateWorkout();
    void hydrateAccount();
    void hydrateWeight();
    void hydrateRoutines();
  }, [hydrateWorkout, hydrateAccount, hydrateWeight, hydrateRoutines]);

  // Gate on the account only once storage has been read, otherwise the first
  // frame bounces a signed-in user to the login screen.
  useEffect(() => {
    if (!accountHydrated) return;
    const onLogin = segments[0] === 'login';
    if (!profile && !onLogin) router.replace('/login');
    else if (profile && onLogin) router.replace('/');
  }, [accountHydrated, profile, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg.app }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg.app },
          }}
        >
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          {/* Once a session is running it owns the screen, so the active
              workout is presented over the tabs rather than inside them. */}
          <Stack.Screen
            name="workout/active"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen
            name="workout/pick-exercise"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="workout/summary"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen
            name="routine/edit"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
        {/* Mounted once at the root: React Native's Alert is a no-op on web,
            so every confirm in the app routes through this instead. */}
        <DialogHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
