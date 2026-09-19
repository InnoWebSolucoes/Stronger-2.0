import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  Heart,
  Info,
  MessageCircle,
  Plus,
  Share2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react-native';
import { Screen } from '@/ui/primitives/Screen';
import { confirm } from '@/ui/primitives/Dialog';
import { MuscleMap, muscleShares } from '@/ui/charts/MuscleMap';
import { c, radius, shadow, space, type } from '@/ui/tokens.bridge';
import { formatVolume } from '@core/scoring';
import { useAccount } from '@/features/account/store';
import { useWorkout } from '@/features/workout/store';
import type { CompletedWorkout } from '@/features/workout/types';
import {
  allGroups,
  authorFor,
  feedFor,
  useCommunity,
  type FeedTab,
} from '@/features/community/store';
import { SELF_AUTHOR_ID, type FeedPost, type Group } from '@/features/community/types';

/**
 * Community — entirely on-device.
 *
 * There is no backend yet, so this screen never pretends otherwise: no
 * spinners, no "syncing", no counters that tick on their own. The sample
 * accounts are labelled as samples, and the banner states plainly that posts
 * stay on this phone. Likes, groups and shares are real local writes.
 */

const LOCAL_NOTE =
  'Posts, likes and groups live on this device. Sample accounts fill the feed until sync ships.';

function relativeTime(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function duration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------

function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Segmented({
  tab,
  onChange,
}: {
  tab: FeedTab;
  onChange: (t: FeedTab) => void;
}) {
  const items: { key: FeedTab; label: string }[] = [
    { key: 'following', label: 'Following' },
    { key: 'discover', label: 'Discover' },
  ];
  return (
    <View style={styles.segmented}>
      {items.map((item) => {
        const active = item.key === tab;
        return (
          <Pressable
            key={item.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

function GroupsRow({
  groups,
  joined,
  onToggleJoin,
  onCreate,
  onLongPress,
}: {
  groups: readonly Group[];
  joined: readonly string[];
  onToggleJoin: (id: string) => void;
  onCreate: () => void;
  onLongPress: (g: Group) => void;
}) {
  return (
    <View style={styles.groupsBlock}>
      <Text style={styles.overline}>Groups</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groupsRow}
      >
        <Pressable style={styles.groupItem} onPress={onCreate}>
          <View style={styles.groupCreate}>
            <Plus color={c.brand.base} size={20} />
          </View>
          <Text style={styles.groupName} numberOfLines={1}>
            New
          </Text>
          <Text style={styles.groupMeta}>create</Text>
        </Pressable>

        {groups.map((g) => {
          const isJoined = joined.includes(g.id);
          return (
            <Pressable
              key={g.id}
              style={styles.groupItem}
              onPress={() => onToggleJoin(g.id)}
              onLongPress={() => onLongPress(g)}
            >
              <View style={[styles.groupCircle, isJoined && styles.groupCircleJoined]}>
                <Text
                  style={[styles.groupInitials, isJoined && styles.groupInitialsJoined]}
                >
                  {g.initials}
                </Text>
                {isJoined ? (
                  <View style={styles.groupCheck}>
                    <Check color={c.fg.onAccent} size={10} strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.groupName} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={styles.groupMeta}>
                {g.mine ? 'yours' : `${g.members} members`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CreateGroupSheet({
  visible,
  onCancel,
  onCreate,
}: {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const close = () => {
    setName('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>New group</Text>
          <Text style={styles.sheetMessage}>
            Created on this device. You can invite people once sync ships.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tuesday Squat Club"
            placeholderTextColor={c.fg.disabled}
            style={styles.input}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (name.trim()) {
                onCreate(name);
                setName('');
              }
            }}
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetCancel} onPress={close}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetConfirm, !name.trim() && styles.sheetConfirmDisabled]}
              disabled={!name.trim()}
              onPress={() => {
                onCreate(name);
                setName('');
              }}
            >
              <Text style={styles.sheetConfirmText}>Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function ShareCard({
  workout,
  units,
  onShare,
}: {
  workout: CompletedWorkout;
  units: 'kg' | 'lb';
  onShare: (caption: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const shares = useMemo(() => muscleShares(workout.exercises), [workout]);

  return (
    <View style={styles.shareCard}>
      <View style={styles.shareHeader}>
        <Share2 color={c.brand.base} size={15} />
        <Text style={styles.shareHeaderText}>Share this workout</Text>
      </View>

      <View style={styles.shareBody}>
        <View style={styles.shareMap}>
          <MuscleMap shares={shares} height={96} />
        </View>
        <View style={styles.shareInfo}>
          <Text style={styles.shareName} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={styles.shareMeta}>
            {relativeTime(workout.finishedAt, Date.now())} ·{' '}
            {duration(workout.durationSec)}
          </Text>
          <View style={styles.shareStats}>
            <Stat label="Volume" value={formatVolume(workout.volumeKg, units)} />
            <Stat label="Reps" value={String(workout.totalReps)} />
            <Stat label="Sets" value={String(workout.totalSets)} />
          </View>
        </View>
      </View>

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption (optional)"
        placeholderTextColor={c.fg.disabled}
        style={styles.captionInput}
        maxLength={140}
        multiline
      />

      <View style={styles.privacyRow}>
        <ShieldCheck color={c.positive.text} size={13} />
        <Text style={styles.privacyText}>
          Numbers and the muscle map only. Photos and bodyweight are never attached.
        </Text>
      </View>

      <Pressable
        style={styles.shareButton}
        onPress={() => {
          onShare(caption);
          setCaption('');
        }}
      >
        <Text style={styles.shareButtonText}>Post to my feed</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

function PostCard({
  post,
  units,
  selfName,
  selfInitials,
  liked,
  likes,
  now,
  onToggleLike,
  onRemove,
}: {
  post: FeedPost;
  units: 'kg' | 'lb';
  selfName: string;
  selfInitials: string;
  liked: boolean;
  likes: number;
  now: number;
  onToggleLike: () => void;
  onRemove: (() => void) | null;
}) {
  const author = authorFor(post.authorId);
  const isSelf = post.authorId === SELF_AUTHOR_ID;
  const name = isSelf ? selfName : (author?.name ?? 'Unknown');
  const handle = isSelf ? 'you' : (author?.handle ?? 'unknown');
  const initials = isSelf ? selfInitials : (author?.initials ?? '?');

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Avatar initials={initials} />
        <View style={styles.postWho}>
          <View style={styles.postNameRow}>
            <Text style={styles.postName} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.tag, isSelf ? styles.tagSelf : styles.tagSample]}>
              <Text style={[styles.tagText, isSelf && styles.tagTextSelf]}>
                {isSelf ? 'Yours' : 'Sample'}
              </Text>
            </View>
          </View>
          <Text style={styles.postHandle} numberOfLines={1}>
            @{handle} · {relativeTime(post.createdAt, now)}
          </Text>
        </View>
        {onRemove ? (
          <Pressable hitSlop={10} onPress={onRemove} style={styles.postRemove}>
            <Trash2 color={c.fg.tertiary} size={16} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.postWorkout} numberOfLines={1}>
        {post.workoutName}
      </Text>
      {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}

      <View style={styles.postBody}>
        <View style={styles.postMap}>
          <MuscleMap shares={post.shares} height={104} />
        </View>
        <View style={styles.postStats}>
          <Stat label="Volume" value={formatVolume(post.volumeKg, units)} />
          <Stat label="Reps" value={String(post.totalReps)} />
          <Stat label="Sets" value={String(post.totalSets)} />
          <Stat label="Time" value={duration(post.durationSec)} />
        </View>
      </View>

      <View style={styles.postFooter}>
        <Pressable
          style={styles.likeButton}
          onPress={onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
        >
          <Heart
            color={liked ? c.negative.text : c.fg.tertiary}
            fill={liked ? c.negative.text : 'transparent'}
            size={17}
          />
          <Text style={[styles.footerCount, liked && styles.footerCountLiked]}>
            {likes}
          </Text>
        </Pressable>

        <View style={styles.commentStat}>
          <MessageCircle color={c.fg.tertiary} size={17} />
          <Text style={styles.footerCount}>{post.comments}</Text>
        </View>

        <View style={{ flex: 1 }} />
        <Text style={styles.postExercises}>
          {post.exerciseCount} {post.exerciseCount === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function EmptyFeed({ tab }: { tab: FeedTab }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Users color={c.fg.tertiary} size={22} />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'following' ? 'Nothing from your circle yet' : 'No sessions to show'}
      </Text>
      <Text style={styles.emptyBody}>
        {tab === 'following'
          ? 'Share a finished workout, or browse Discover to see how other sessions look.'
          : 'Finish a workout and it will appear here.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function CommunityTab() {
  const [tab, setTab] = useState<FeedTab>('following');
  const [creating, setCreating] = useState(false);
  // Frozen at mount so every '3h ago' in the list is measured from one instant.
  const [now] = useState(() => Date.now());

  const profile = useAccount((s) => s.profile);
  const history = useWorkout((s) => s.history);

  const hydrated = useCommunity((s) => s.hydrated);
  const hydrate = useCommunity((s) => s.hydrate);
  const fixtures = useCommunity((s) => s.fixtures);
  const shared = useCommunity((s) => s.shared);
  const liked = useCommunity((s) => s.liked);
  const myGroups = useCommunity((s) => s.groups);
  const joined = useCommunity((s) => s.joined);
  const toggleLike = useCommunity((s) => s.toggleLike);
  const shareWorkout = useCommunity((s) => s.shareWorkout);
  const unshare = useCommunity((s) => s.unshare);
  const createGroup = useCommunity((s) => s.createGroup);
  const toggleJoin = useCommunity((s) => s.toggleJoin);
  const leaveOrDelete = useCommunity((s) => s.leaveOrDeleteGroup);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const units: 'kg' | 'lb' = profile?.units ?? 'kg';
  const selfName = profile?.name ?? 'You';
  const selfInitials = profile?.initials ?? 'ME';

  const posts = useMemo(() => feedFor(tab, fixtures, shared), [tab, fixtures, shared]);
  const groups = useMemo(() => allGroups(myGroups), [myGroups]);

  // The most recent finished session that has not been posted yet. Only one is
  // offered at a time — a queue of "share these 40 workouts" is a chore, not a
  // feature.
  const sharable = useMemo(() => {
    const sharedIds = new Set(
      shared.map((p) => p.sourceWorkoutId).filter((id): id is string => id !== undefined),
    );
    return history.find((w) => !sharedIds.has(w.id)) ?? null;
  }, [history, shared]);

  const explain = async () => {
    await confirm({
      title: 'This feed is local',
      message:
        'Stronger has no social backend yet. Your posts, likes and groups are stored on this device and go no further. The accounts in Discover are sample data shipped with the app so the feed has something in it — they are not real people posting today.',
      confirmLabel: 'Got it',
      cancelLabel: 'Close',
    });
  };

  const removePost = async (post: FeedPost) => {
    const ok = await confirm({
      title: 'Remove this post?',
      message: 'It will be taken off your feed. The workout itself stays in your history.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) unshare(post.id);
  };

  const onGroupLongPress = async (g: Group) => {
    if (!g.mine) return;
    const ok = await confirm({
      title: `Delete ${g.name}?`,
      message: 'This group only exists on this device.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) leaveOrDelete(g.id);
  };

  return (
    <Screen
      title="Community"
      subtitle="Groups, friends and shared sessions"
      action={
        <Pressable style={styles.iconButton} hitSlop={8} onPress={explain}>
          <Info color={c.fg.secondary} size={20} />
        </Pressable>
      }
    >
      <Pressable style={styles.notice} onPress={explain}>
        <Smartphone color={c.fg.tertiary} size={15} />
        <Text style={styles.noticeText}>{LOCAL_NOTE}</Text>
      </Pressable>

      <GroupsRow
        groups={groups}
        joined={joined}
        onToggleJoin={toggleJoin}
        onCreate={() => setCreating(true)}
        onLongPress={onGroupLongPress}
      />

      <Segmented tab={tab} onChange={setTab} />

      {sharable ? (
        <ShareCard
          workout={sharable}
          units={units}
          onShare={(caption) => {
            shareWorkout(sharable, caption);
            setTab('following');
          }}
        />
      ) : history.length === 0 ? (
        <View style={styles.sharePrompt}>
          <Share2 color={c.fg.tertiary} size={16} />
          <Text style={styles.sharePromptText}>
            Finish a workout and it will show up here, ready to post.
          </Text>
        </View>
      ) : (
        <View style={styles.sharePrompt}>
          <Check color={c.positive.text} size={16} />
          <Text style={styles.sharePromptText}>
            Your latest session is already on your feed.
          </Text>
        </View>
      )}

      {posts.length === 0 ? (
        <EmptyFeed tab={tab} />
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            units={units}
            selfName={selfName}
            selfInitials={selfInitials}
            now={now}
            liked={liked.includes(post.id)}
            likes={post.likes + (liked.includes(post.id) ? 1 : 0)}
            onToggleLike={() => toggleLike(post.id)}
            onRemove={
              post.authorId === SELF_AUTHOR_ID ? () => void removePost(post) : null
            }
          />
        ))
      )}

      <CreateGroupSheet
        visible={creating}
        onCancel={() => setCreating(false)}
        onCreate={(name) => {
          createGroup(name);
          setCreating(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  noticeText: { ...type.caption, color: c.fg.tertiary, flex: 1 },

  overline: { ...type.overline, color: c.fg.tertiary, textTransform: 'uppercase' },

  groupsBlock: { marginTop: space.xl, gap: space.md },
  groupsRow: { gap: space.md, paddingRight: space.lg },
  groupItem: { width: 72, alignItems: 'center', gap: 6 },
  groupCircle: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCircleJoined: {
    backgroundColor: c.brand.weak,
    borderColor: c.brand.borderWeak,
  },
  groupCreate: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInitials: { ...type.bodyStrong, color: c.fg.secondary, letterSpacing: 0.4 },
  groupInitialsJoined: { color: c.brand.text },
  groupCheck: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: c.brand.base,
    borderWidth: 2,
    borderColor: c.bg.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { ...type.caption, color: c.fg.secondary, fontSize: 12 },
  groupMeta: { ...type.caption, color: c.fg.disabled, fontSize: 10 },

  segmented: {
    flexDirection: 'row',
    marginTop: space.xl,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: c.surface[3] },
  segmentText: { ...type.bodyStrong, color: c.fg.tertiary },
  segmentTextActive: { color: c.fg.primary },

  // Share card ------------------------------------------------------------
  shareCard: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    gap: space.md,
    ...shadow[1],
  },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shareHeaderText: { ...type.overline, color: c.brand.text, textTransform: 'uppercase' },
  shareBody: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  shareMap: {
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
  },
  shareInfo: { flex: 1, gap: 2 },
  shareName: { ...type.heading, color: c.fg.primary },
  shareMeta: { ...type.caption, color: c.fg.tertiary },
  shareStats: { flexDirection: 'row', gap: space.lg, marginTop: space.md },

  captionInput: {
    ...type.body,
    color: c.fg.primary,
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  privacyText: { ...type.caption, color: c.fg.tertiary, flex: 1, fontSize: 12 },
  shareButton: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.brand.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: { ...type.bodyStrong, color: c.fg.onAccent },

  sharePrompt: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
  },
  sharePromptText: { ...type.caption, color: c.fg.tertiary, flex: 1 },

  // Post ------------------------------------------------------------------
  post: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    gap: space.md,
    ...shadow[1],
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  postWho: { flex: 1, gap: 1 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  postName: { ...type.bodyStrong, color: c.fg.primary, flexShrink: 1 },
  postHandle: { ...type.caption, color: c.fg.tertiary },
  postRemove: { padding: space.xs },

  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  tagSample: { backgroundColor: c.surface[2], borderColor: c.border.subtle },
  tagSelf: { backgroundColor: c.brand.weak, borderColor: c.brand.borderWeak },
  tagText: { ...type.caption, fontSize: 10, fontWeight: '700', color: c.fg.tertiary },
  tagTextSelf: { color: c.brand.text },

  postWorkout: { ...type.heading, color: c.fg.primary, marginTop: -space.xs },
  postCaption: { ...type.body, color: c.fg.secondary, marginTop: -space.sm },

  postBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
  },
  postMap: { alignItems: 'center' },
  postStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },

  stat: { minWidth: 64, gap: 1 },
  statValue: {
    ...type.bodyStrong,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...type.caption,
    color: c.fg.tertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border.subtle,
  },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  commentStat: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footerCount: {
    ...type.caption,
    color: c.fg.tertiary,
    fontVariant: ['tabular-nums'],
    minWidth: 16,
  },
  footerCountLiked: { color: c.negative.text, fontWeight: '600' },
  postExercises: { ...type.caption, color: c.fg.disabled, fontSize: 11 },

  avatar: {
    backgroundColor: c.surface[3],
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.bodyStrong, color: c.fg.secondary, letterSpacing: 0.3 },

  // Empty -----------------------------------------------------------------
  empty: {
    marginTop: space.xl,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space['3xl'],
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.surface[2],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptyTitle: { ...type.heading, color: c.fg.primary },
  emptyBody: { ...type.caption, color: c.fg.tertiary, textAlign: 'center' },

  // Create-group sheet ----------------------------------------------------
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
  sheetTitle: { ...type.heading, color: c.fg.primary },
  sheetMessage: { ...type.body, color: c.fg.secondary },
  input: {
    ...type.body,
    color: c.fg.primary,
    height: 46,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.border.strong,
  },
  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  sheetCancel: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: { ...type.bodyStrong, color: c.fg.primary },
  sheetConfirm: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmDisabled: { backgroundColor: c.surface[3] },
  sheetConfirmText: { ...type.bodyStrong, color: c.fg.onAction },
});
