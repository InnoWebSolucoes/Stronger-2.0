import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Dumbbell, House, LineChart, User, Users } from 'lucide-react-native';
import { c, radius, space } from '@/ui/tokens.bridge';

type IconProps = { color: string; size: number };

/**
 * The active tab gets an amber pill behind its icon. The label carries the
 * state too — colour is never the only signal.
 */
function TabIcon({
  focused,
  render,
}: {
  focused: boolean;
  render: (p: IconProps) => React.ReactNode;
}) {
  return (
    <View style={[styles.iconSlot, focused && styles.iconSlotActive]}>
      {render({ color: focused ? c.brand.base : c.fg.tertiary, size: 22 })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: c.brand.base,
        tabBarInactiveTintColor: c.fg.tertiary,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: c.bg.app },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} render={(p) => <House {...p} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} render={(p) => <Dumbbell {...p} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} render={(p) => <LineChart {...p} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} render={(p) => <Users {...p} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} render={(p) => <User {...p} />} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: c.bg.canvas,
    borderTopColor: c.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingTop: space.sm,
  },
  item: {
    paddingTop: space.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  iconSlot: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotActive: {
    backgroundColor: c.brand.weak,
  },
});
