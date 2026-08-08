/**
 * Yazma katmanı yüzeyi — plan M8.
 */

export { extractSkeleton } from './skeleton'
export type { DocumentSkeleton, NumberingStyle, SkeletonSection } from './skeleton'

export { addDocument, emptyStyleProfile } from './styleProfile'
export type { LengthDistribution, SampleParagraph, StyleProfile } from './styleProfile'

export { estimateTokens, selectFewShot } from './fewShot'
export type { FewShotCandidate, FewShotExample, FewShotOptions, FewShotSelection } from './fewShot'

export { generateStaged } from './staged'
export type {
  ConsistencyIssue,
  ConsistencyReport,
  DocumentOutline,
  GenerateStagedOptions,
  GeneratedSection,
  OutlineRequest,
  OutlineSection,
  SectionRequest,
  SectionSummary,
  StagedDocument,
  WriteBackend,
} from './staged'
