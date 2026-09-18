/**
 * Progress-photo data model and privacy rules - types and predicates only.
 *
 * Progress photos tied to a bodyweight are health data under GDPR Article 9,
 * special-category regardless of whether a clinician is involved. Article 9
 * needs a cumulative lawful basis: an Article 6 basis AND an Article 9
 * exception, in practice Art. 9(2)(a) explicit consent, which must be a
 * SEPARATE affirmative act from accepting the terms of service.
 *
 * A photograph only becomes Article 9 BIOMETRIC data when it is "processed
 * through specific technical means allowing the unique identification or
 * authentication of a natural person". Storing a photo is not that; running
 * face recognition over it is. So pose landmarks for framing are allowed
 * (non-identifying, ephemeral, never persisted) and face recognition, face
 * clustering and identity matching are not - ever, for any purpose.
 *
 * The types here are built so that the unsafe combinations cannot be written
 * down:
 * - {@link ConsentMechanism} has exactly one member,
 *   `separate-affirmative-action`; a ToS-bundled consent has no
 *   representation.
 * - {@link PhotoProcessing} lists only permitted operations; face recognition
 *   is not a member, and {@link FORBIDDEN_PROCESSING} catches identity
 *   operations arriving as untyped strings from storage or a remote config.
 * - {@link ProgressPhoto} pins `landmarksPersisted: false`,
 *   `inOsPhotoLibrary: false` and `includedInDeviceBackup: false` as literal
 *   types, so a photo object that claims otherwise will not type-check.
 * - A Community post cannot reference a {@link ProgressPhoto} at all. It can
 *   only take a {@link ShareableCopy}, which exists only as the return value of
 *   {@link createShareableCopy}, which requires a user-initiated gesture and a
 *   live share consent.
 *
 * Sources:
 * - Art. 9 special-category / biometric definition:
 *   https://gdpr-info.eu/art-9-gdpr/ and
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
 * - DPIA, minimisation, storage limitation, erasure, portability:
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/
 * - AGENTS.md constraint 5 and the research brief Summary (on-device by
 *   default, crypto-shred deletion, no path to the post composer).
 *
 * Actual capture, encryption and file IO belong to the platform layer; this
 * module is pure TypeScript and touches no bytes.
 */

/** Poses captured in a progress-photo set. */
export type PhotoPose = 'front' | 'side-left' | 'side-right' | 'back';

/**
 * How consent was obtained.
 *
 * The single member is deliberate: Art. 9(2)(a) explicit consent must be a
 * separate affirmative act, so there is no `bundled-with-tos` or
 * `implied-by-use` member to assign.
 */
export type ConsentMechanism = 'separate-affirmative-action';

/** What a consent record permits. One record per purpose; never a bundle. */
export type ConsentPurpose =
  | 'store-progress-photos'
  | 'encrypted-cloud-backup'
  | 'share-photo-externally';

/** An Art. 9(2)(a) explicit consent record. */
export interface ExplicitConsent {
  /** Stable id (ULID). */
  readonly id: string;
  /** The one purpose this record covers. */
  readonly purpose: ConsentPurpose;
  /** Always `separate-affirmative-action`; see {@link ConsentMechanism}. */
  readonly mechanism: ConsentMechanism;
  /** When consent was given, epoch ms UTC. */
  readonly grantedAt: number;
  /** Version of the privacy notice shown at the time. */
  readonly policyVersion: string;
  /** When consent was withdrawn, epoch ms UTC, or `null` while it stands. */
  readonly withdrawnAt: number | null;
}

/**
 * Processing operations permitted on a progress photo.
 *
 * Face recognition, face clustering, identity matching and any other unique
 * identification are absent by construction; adding one would be a deliberate
 * edit to this union and should never pass review.
 */
export type PhotoProcessing =
  | 'pose-landmarks-ephemeral'
  | 'edge-silhouette-overlay'
  | 'downscale'
  | 're-encode'
  | 'encrypt'
  | 'decrypt-for-display'
  | 'user-initiated-crop'
  | 'user-initiated-delete';

/**
 * Operation names that must never run on a progress photo, checked at runtime
 * for values crossing a boundary (database rows, sync payloads, remote config)
 * where the type system cannot reach.
 */
export const FORBIDDEN_PROCESSING: readonly string[] = [
  'face-detection',
  'face-recognition',
  'face-clustering',
  'face-embedding',
  'identity-matching',
  'biometric-template',
  'age-estimation',
  'gender-classification',
  'emotion-detection',
  'third-party-analytics-upload',
  'ad-targeting',
];

/** Where the encrypted bytes live. */
export type PhotoStorage =
  | {
      /** App-internal storage: never media-scanned, never in the OS gallery. */
      readonly kind: 'app-internal';
      readonly encryption: 'aes-256-gcm';
      /** iOS Data Protection class; `complete` = key discarded ~10 s after lock. */
      readonly fileProtection: 'complete';
    }
  | {
      /** Opt-in end-to-end-encrypted backup, unreadable by the server. */
      readonly kind: 'e2ee-cloud-backup';
      readonly encryption: 'aes-256-gcm';
      /** Recovery-code length in words. */
      readonly recoveryCodeWords: 12;
      /** The `encrypted-cloud-backup` consent that authorised this. */
      readonly consentId: string;
    };

/** A stored progress photo. */
export interface ProgressPhoto {
  /** Stable id (ULID) - never an array index, so history survives edits. */
  readonly id: string;
  /** When the photo was taken, epoch ms UTC. */
  readonly capturedAt: number;
  /** Pose captured. */
  readonly pose: PhotoPose;
  /** Where the encrypted bytes live. */
  readonly storage: PhotoStorage;
  /** The `store-progress-photos` consent this photo was captured under. */
  readonly consentId: string;
  /** Bodyweight recorded alongside, kg (canonical unit), or `null`. */
  readonly bodyweightKg: number | null;
  /**
   * Always false. Alignment landmarks are computed for framing and discarded;
   * persisting them would risk turning the photo into Art. 9 biometric data.
   */
  readonly landmarksPersisted: false;
  /** Always false. We never request add-to-library permission. */
  readonly inOsPhotoLibrary: false;
  /** Always false. Excluded from iCloud and Android backup. */
  readonly includedInDeviceBackup: false;
}

/**
 * A derived copy that may leave the vault. The only thing a Community post or
 * an OS share sheet can accept; a {@link ProgressPhoto} itself has no path
 * there.
 */
export interface ShareableCopy {
  /** Id of the photo this was derived from. */
  readonly derivedFromPhotoId: string;
  /** The `share-photo-externally` consent that authorised this copy. */
  readonly consentId: string;
  /** When the copy was created, epoch ms UTC. */
  readonly createdAt: number;
  /** Always true: EXIF, GPS and timestamps are stripped from the copy. */
  readonly metadataStripped: true;
  /** Always true: the copy is created only in response to a user gesture. */
  readonly userInitiated: true;
}

/** Who asked for something to happen. */
export type Initiator = 'user' | 'system' | 'sync' | 'recommendation-engine';

/** A request to produce a shareable copy. */
export interface ShareRequest {
  /** Only `user` can ever succeed; anything else is an auto-attach attempt. */
  readonly initiatedBy: Initiator;
  /** The concrete gesture, for the audit trail. */
  readonly gesture: 'explicit-share-tap' | 'explicit-export-tap' | 'none';
  /** When the request was made, epoch ms UTC. */
  readonly at: number;
}

/** Allowed, or denied with a reason and the rule behind it. */
export type PrivacyDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      /** Stable code for analytics and copy lookup. */
      readonly code: PrivacyDenialCode;
      /** Plain-language reason, safe to show verbatim. */
      readonly reason: string;
      /** The rule this rests on. */
      readonly basis: string;
    };

/** Why a privacy predicate said no. */
export type PrivacyDenialCode =
  | 'no-explicit-consent'
  | 'consent-withdrawn'
  | 'consent-policy-outdated'
  | 'not-user-initiated'
  | 'forbidden-processing'
  | 'retention-expired';

const DENIALS: Record<PrivacyDenialCode, { reason: string; basis: string }> = {
  'no-explicit-consent': {
    reason: 'Progress photos need their own explicit consent, separate from the terms of service.',
    basis: 'GDPR Art. 9(2)(a) explicit consent for special-category health data.',
  },
  'consent-withdrawn': {
    reason: 'Consent for this was withdrawn.',
    basis: 'GDPR Art. 7(3): withdrawing consent must be as easy as giving it.',
  },
  'consent-policy-outdated': {
    reason: 'The privacy notice has changed since consent was given, so consent must be asked again.',
    basis: 'GDPR Art. 9(2)(a): consent must be informed and specific to the processing described.',
  },
  'not-user-initiated': {
    reason: 'Progress photos are never attached automatically. Only you can share one, by tapping share.',
    basis: 'AGENTS.md constraint 5: never auto-attached to social posts.',
  },
  'forbidden-processing': {
    reason: 'That operation would identify a person from the photo, which this app never does.',
    basis: 'GDPR Art. 9: a photo becomes biometric data when processed for unique identification.',
  },
  'retention-expired': {
    reason: 'This photo has passed its retention period and is due for deletion.',
    basis: 'GDPR Art. 5(1)(e) storage limitation, a standing obligation independent of any request.',
  },
};

function deny(code: PrivacyDenialCode): PrivacyDecision {
  const detail = DENIALS[code];
  return { allowed: false, code, reason: detail.reason, basis: detail.basis };
}

const ALLOW: PrivacyDecision = { allowed: true };

/**
 * Whether a consent record is currently in force.
 *
 * @param consent The record, or null/undefined when none exists.
 * @param now Current instant, epoch ms UTC (injected; `src/core` has no clock).
 * @param currentPolicyVersion If given, consent granted under an older privacy
 *   notice is treated as stale and must be re-asked.
 */
export function isConsentActive(
  consent: ExplicitConsent | null | undefined,
  now: number,
  currentPolicyVersion?: string,
): boolean {
  if (consent === null || consent === undefined) return false;
  if (consent.mechanism !== 'separate-affirmative-action') return false;
  if (!Number.isFinite(consent.grantedAt) || consent.grantedAt > now) return false;
  if (consent.withdrawnAt !== null && consent.withdrawnAt <= now) return false;
  if (currentPolicyVersion !== undefined && consent.policyVersion !== currentPolicyVersion) {
    return false;
  }
  return true;
}

/**
 * Finds the active consent for a purpose, most recently granted first.
 *
 * @returns The record, or `null` when there is no live consent for that purpose.
 */
export function findActiveConsent(
  consents: readonly ExplicitConsent[],
  purpose: ConsentPurpose,
  now: number,
  currentPolicyVersion?: string,
): ExplicitConsent | null {
  const matches = consents
    .filter((consent) => consent.purpose === purpose)
    .filter((consent) => isConsentActive(consent, now, currentPolicyVersion))
    .sort((a, b) => b.grantedAt - a.grantedAt);
  return matches[0] ?? null;
}

function requireConsent(
  consents: readonly ExplicitConsent[],
  purpose: ConsentPurpose,
  now: number,
  currentPolicyVersion?: string,
): PrivacyDecision {
  const active = findActiveConsent(consents, purpose, now, currentPolicyVersion);
  if (active !== null) return ALLOW;

  const anyForPurpose = consents.filter((consent) => consent.purpose === purpose);
  if (anyForPurpose.length === 0) return deny('no-explicit-consent');
  if (anyForPurpose.some((consent) => consent.withdrawnAt !== null && consent.withdrawnAt <= now)) {
    return deny('consent-withdrawn');
  }
  if (
    currentPolicyVersion !== undefined &&
    anyForPurpose.every((consent) => consent.policyVersion !== currentPolicyVersion)
  ) {
    return deny('consent-policy-outdated');
  }
  return deny('no-explicit-consent');
}

/**
 * Whether a progress photo may be captured and stored at all.
 *
 * @param consents Every consent record held for the user.
 * @param now Current instant, epoch ms UTC.
 * @param currentPolicyVersion Version of the live privacy notice, if enforced.
 */
export function canCaptureProgressPhoto(
  consents: readonly ExplicitConsent[],
  now: number,
  currentPolicyVersion?: string,
): PrivacyDecision {
  return requireConsent(consents, 'store-progress-photos', now, currentPolicyVersion);
}

/**
 * Whether a photo may be uploaded to the end-to-end-encrypted cloud backup.
 *
 * Requires a live `encrypted-cloud-backup` consent, separate from the consent
 * to store photos on the device at all: on-device is the default, cloud is an
 * additional, separately consented purpose.
 */
export function canBackUpToCloud(
  consents: readonly ExplicitConsent[],
  now: number,
  currentPolicyVersion?: string,
): PrivacyDecision {
  const storeDecision = requireConsent(consents, 'store-progress-photos', now, currentPolicyVersion);
  if (!storeDecision.allowed) return storeDecision;
  return requireConsent(consents, 'encrypted-cloud-backup', now, currentPolicyVersion);
}

/**
 * Whether an operation may run on a progress photo.
 *
 * @param operation A {@link PhotoProcessing} value, or any string arriving from
 *   storage, sync or remote config.
 */
export function isProcessingPermitted(operation: PhotoProcessing | string): boolean {
  const permitted: readonly string[] = [
    'pose-landmarks-ephemeral',
    'edge-silhouette-overlay',
    'downscale',
    're-encode',
    'encrypt',
    'decrypt-for-display',
    'user-initiated-crop',
    'user-initiated-delete',
  ];
  if (FORBIDDEN_PROCESSING.includes(operation)) return false;
  return permitted.includes(operation);
}

/**
 * Validates a whole processing pipeline before any of it runs. One forbidden
 * or unrecognised step rejects the pipeline; there is no partial execution.
 */
export function validateProcessingPipeline(
  operations: readonly (PhotoProcessing | string)[],
): PrivacyDecision {
  for (const operation of operations) {
    if (!isProcessingPermitted(operation)) return deny('forbidden-processing');
  }
  return ALLOW;
}

/**
 * Face recognition and identity matching on progress photos. Always false,
 * unconditionally, with no parameters to make it true - exported so calling
 * code reads as a policy check rather than a hard-coded `false`.
 *
 * Source: GDPR Art. 9 - processing "through specific technical means allowing
 * the unique identification" is what would make these photos biometric data.
 */
export function isIdentityProcessingPermitted(): false {
  return false;
}

/**
 * Automatic attachment of a progress photo to a social post. Always false.
 *
 * Source: AGENTS.md constraint 5; the research brief requires photos to be
 * structurally unable to reach the Community tab.
 */
export function isAutoAttachPermitted(): false {
  return false;
}

/**
 * Produces the only artefact that may leave the photo vault.
 *
 * Requires a user-initiated gesture and a live `share-photo-externally`
 * consent. A `system`, `sync` or `recommendation-engine` initiator is denied,
 * which is what makes auto-attachment impossible rather than merely
 * discouraged.
 *
 * @returns The decision, with the {@link ShareableCopy} when allowed. Only the
 *   copy - never the {@link ProgressPhoto} - can be handed to a post composer
 *   or share sheet.
 */
export function createShareableCopy(
  photo: ProgressPhoto,
  consents: readonly ExplicitConsent[],
  request: ShareRequest,
  now: number,
  currentPolicyVersion?: string,
):
  | { readonly allowed: true; readonly copy: ShareableCopy }
  | Exclude<PrivacyDecision, { readonly allowed: true }> {
  if (request.initiatedBy !== 'user' || request.gesture === 'none') {
    return deny('not-user-initiated') as Exclude<PrivacyDecision, { readonly allowed: true }>;
  }
  const consentDecision = requireConsent(
    consents,
    'share-photo-externally',
    now,
    currentPolicyVersion,
  );
  if (!consentDecision.allowed) {
    return consentDecision as Exclude<PrivacyDecision, { readonly allowed: true }>;
  }
  const consent = findActiveConsent(consents, 'share-photo-externally', now, currentPolicyVersion);
  if (consent === null) {
    return deny('no-explicit-consent') as Exclude<PrivacyDecision, { readonly allowed: true }>;
  }
  return {
    allowed: true,
    copy: {
      derivedFromPhotoId: photo.id,
      consentId: consent.id,
      createdAt: now,
      metadataStripped: true,
      userInitiated: true,
    },
  };
}

/**
 * Whether a photo has passed its retention period.
 *
 * Art. 5(1)(e) storage limitation is a standing obligation: deletion is due
 * whether or not the user asks.
 *
 * @param photo The photo.
 * @param retentionDays Retention period in days. Non-positive means "keep until
 *   the user deletes it", which returns false.
 * @param now Current instant, epoch ms UTC.
 */
export function isRetentionExpired(
  photo: ProgressPhoto,
  retentionDays: number,
  now: number,
): boolean {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return false;
  return now - photo.capturedAt > retentionDays * 86_400_000;
}

/**
 * Photos due for deletion under the retention policy, oldest first.
 *
 * @returns The photo ids the platform layer should erase.
 */
export function photosDueForErasure(
  photos: readonly ProgressPhoto[],
  retentionDays: number,
  now: number,
): string[] {
  return photos
    .filter((photo) => isRetentionExpired(photo, retentionDays, now))
    .sort((a, b) => a.capturedAt - b.capturedAt)
    .map((photo) => photo.id);
}

/** Instructions for the platform layer to erase photo data. */
export interface ErasurePlan {
  /** Photo ids to remove from the index. */
  readonly photoIds: readonly string[];
  /**
   * True when every photo is being erased: the platform layer then discards the
   * vault key, which makes all ciphertext unrecoverable immediately rather than
   * waiting on a purge queue.
   */
  readonly cryptoShredVaultKey: boolean;
  /** Consent records to mark withdrawn alongside the erasure. */
  readonly withdrawConsentPurposes: readonly ConsentPurpose[];
}

/**
 * Builds an erasure plan.
 *
 * "Delete everything" is a crypto-shred of the vault key rather than a
 * best-effort file sweep, so the data is unrecoverable the moment the key is
 * gone. A partial erasure removes the named photos and leaves the vault intact.
 *
 * @param allPhotos Every photo currently held.
 * @param photoIdsToErase Ids to erase; pass every id for a full erasure.
 * @returns {@link ErasurePlan}. GDPR Art. 17 (erasure) and Art. 5(1)(e).
 */
export function planErasure(
  allPhotos: readonly ProgressPhoto[],
  photoIdsToErase: readonly string[],
): ErasurePlan {
  const targets = new Set(photoIdsToErase.filter((id) => allPhotos.some((p) => p.id === id)));
  const erasingEverything = allPhotos.length > 0 && targets.size === allPhotos.length;
  return {
    photoIds: [...targets],
    cryptoShredVaultKey: erasingEverything,
    withdrawConsentPurposes: erasingEverything
      ? ['store-progress-photos', 'encrypted-cloud-backup', 'share-photo-externally']
      : [],
  };
}
