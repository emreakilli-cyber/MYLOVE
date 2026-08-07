/**
 * `packages/hukuk-ai` genel yüzeyi — plan M13.1.
 *
 * Dışarıya yalnız buradan çıkılır. İç modüller (dedektörler, çakışma çözümü,
 * token dilbilgisi) doğrudan import edilmez; böylece `docs/SPEC.md` sözleşmesi
 * tek kapıdan geçer.
 *
 * Bu paket sıfır bağımlıdır ve ana uygulamadan hiçbir şey import etmez.
 */

export { mask, maskAsync, unmask } from './mask/mask'
export type { MaskAsyncOptions, MaskOptions, MaskResult, UnmaskResult } from './mask/mask'

export { createDictionaryNerBackend, freeRegions } from './mask/ner'
export type {
  AsyncNerBackend,
  DictionaryNerOptions,
  FreeRegion,
  NerBackend,
  NerCandidate,
  NerEntityType,
} from './mask/ner'

export { MaskReview, MaskReviewError } from './mask/review'
export type { ReviewMask, TextRange } from './mask/review'

export { preflightCheck } from './mask/preflight'
export type {
  Destination,
  PreflightEntity,
  PreflightOptions,
  PreflightResult,
} from './mask/preflight'

export { ResearchClient } from './research/client'
export type {
  LocalResearchIndex,
  ResearchClientOptions,
  ResearchDocument,
  ResearchKind,
  ResearchQuery,
  ResearchResponse,
  ResearchSource,
  ResearchTransport,
} from './research/client'

export { UnmaskedContentError, assertMasked, findUnmaskedContent } from './research/guard'
export type { GuardFinding, GuardOptions } from './research/guard'

export { nameKey, splitName } from './turkish/suffix'
export type { SplitName } from './turkish/suffix'

export {
  MASK_TABLE_FORMAT,
  MaskTable,
  MaskTableDecryptError,
  MaskTableSerializationError,
} from './mask/table'
export type { EncryptedMaskTable, MaskEntry, Occurrence } from './mask/table'

export { isMaskToken } from './mask/token'

export { isValidIban, isValidTckn, normalizePhone, runRuleLayer } from './mask/rules'
export type { RuleLayerOptions } from './mask/rules'

export { ENTITY_TYPES, TYPE_PRIORITY } from './types/entities'
export type { DetectionLayer, EntitySpan, EntityType, SuspectSpan } from './types/entities'

export { THRESHOLDS, shouldOfferHandoff } from './handoff/threshold'
export type {
  DeviceCalibration,
  DeviceState,
  HandoffOutcome,
  HandoffTrigger,
  JobEstimate,
  ThermalState,
} from './handoff/threshold'
