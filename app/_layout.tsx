import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useWorkout } from '@/features/workout/store';
import { c } from '@/ui/tokens.bridge';

export default function RootLayout() {
  const hydrate = useWorkout((s) => s.hydrate);

  // Recover any in-progress workout before the first interaction. A session
  // surviving a force-kill is the core promise, so this runs at the root.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
