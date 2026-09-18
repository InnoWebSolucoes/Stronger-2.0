import { create } from 'zustand';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { c, radius, space, type } from '@/ui/tokens.bridge';

/**
 * Cross-platform confirm dialog.
 *
 * React Native's `Alert.alert` is a NO-OP on web — it does not render and does
 * not throw, so every button wired to it silently does nothing in a browser.
 * That made Finish, Discard and Remove exercise appear broken. This renders a
 * real Modal on every platform instead.
 *
 * Imperative by design so call sites stay readable:
 *
 *   if (await confirm({ title: 'Discard workout?', destructive: true })) { ... }
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action in the destructive colour. */
  destructive?: boolean;
};

type DialogState = {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  show: (options: ConfirmOptions) => Promise<boolean>;
  close: (value: boolean) => void;
};

const useDialog = create<DialogState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  show: (options) =>
    new Promise<boolean>((resolve) => {
      // If a dialog is somehow already open, resolve it false rather than
      // orphaning its promise.
      const pending = get().resolve;
      if (pending) pending(false);
      set({ open: true, options, resolve });
    }),
  close: (value) => {
    const { resolve } = get();
    set({ open: false, options: null, resolve: null });
    resolve?.(value);
  },
}));

/** Ask the user to confirm. Resolves true if they accept. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useDialog.getState().show(options);
}

/** Mount once, at the app root. */
export function DialogHost() {
  const open = useDialog((s) => s.open);
  const options = useDialog((s) => s.options);
  const close = useDialog((s) => s.close);

  if (!options) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}
    >
      <Pressable style={styles.scrim} onPress={() => close(false)}>
        {/* Stop taps inside the sheet from dismissing it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{options.title}</Text>
          {options.message ? <Text style={styles.message}>{options.message}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={() => close(false)}>
              <Text style={styles.cancelText}>{options.cancelLabel ?? 'Cancel'}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, options.destructive && styles.confirmDestructive]}
              onPress={() => close(true)}
            >
              <Text
                style={[
                  styles.confirmText,
                  options.destructive && styles.confirmTextDestructive,
                ]}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: c.bg.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.default,
    padding: space.xl,
    gap: space.sm,
  },
  title: { ...type.heading, color: c.fg.primary },
  message: { ...type.body, color: c.fg.secondary },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  cancel: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...type.bodyStrong, color: c.fg.primary },
  confirm: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructive: { backgroundColor: c.negative.fill },
  confirmText: { ...type.bodyStrong, color: c.fg.onAction },
  confirmTextDestructive: { color: '#FFFFFF' },
});
