import type {
  NormalizedRoadmapSnapshot,
  ReviewedTagMappingRow,
} from './parse.js';
import { suggestAutoTagMappings } from './parse.js';

export interface LoadRoadmapResult {
  sourceId: string;
  roadmapsUpserted: number;
  topicsUpserted: number;
  roadmapsDeprecated: number;
  topicsDeprecated: number;
  reviewedMappingsUpserted: number;
  autoSuggestionsUpserted: number;
}

/**
 * Loads a normalized roadmap snapshot into `ai_review.roadmap_*` inside a single ACID transaction.
 * - Upserts roadmaps and topics by stable ID (idempotent across repeated runs of same SHA).
 * - Soft-deprecates (`deprecated_at`) previously ingested roadmaps/topics that disappeared,
 *   preserving existing `topic_tag_map` links instead of hard-deleting.
 */
export async function loadRoadmapSnapshot(
  prisma: any,
  snapshot: NormalizedRoadmapSnapshot,
  reviewedMappings: ReviewedTagMappingRow[] = [],
  now: Date = new Date()
): Promise<LoadRoadmapResult> {
  const autoSuggestions = suggestAutoTagMappings(snapshot);

  return prisma.$transaction(async (tx: any) => {
    const source = await tx.roadmapSource.upsert({
      where: {
        repoUrl_commitSha: {
          repoUrl: snapshot.repoUrl,
          commitSha: snapshot.commitSha,
        },
      },
      update: {
        licenseSha256: snapshot.licenseSha256,
        licenseName: snapshot.licenseName,
        licenseOption: snapshot.licenseOption,
        attribution: snapshot.attribution,
        snapshotChecksum: snapshot.snapshotChecksum,
        ingestedAt: now,
      },
      create: {
        repoUrl: snapshot.repoUrl,
        commitSha: snapshot.commitSha,
        licenseSha256: snapshot.licenseSha256,
        licenseName: snapshot.licenseName,
        licenseOption: snapshot.licenseOption,
        attribution: snapshot.attribution,
        snapshotChecksum: snapshot.snapshotChecksum,
        ingestedAt: now,
      },
    });

    const activeRoadmapIds = new Set<string>();
    const activeTopicIds = new Set<string>();
    let topicsUpserted = 0;

    for (const rm of snapshot.roadmaps) {
      activeRoadmapIds.add(rm.id);
      await tx.roadmap.upsert({
        where: { id: rm.id },
        update: {
          slug: rm.slug,
          title: rm.title,
          description: rm.description,
          orderIndex: rm.orderIndex,
          sourceId: source.id,
          sourceUrl: rm.sourceUrl,
          deprecatedAt: null,
        },
        create: {
          id: rm.id,
          slug: rm.slug,
          title: rm.title,
          description: rm.description,
          orderIndex: rm.orderIndex,
          sourceId: source.id,
          sourceUrl: rm.sourceUrl,
          deprecatedAt: null,
        },
      });

      // Upsert parent topics first, then subtopics (respects self-referencing FK)
      const parentNodes = rm.topics.filter((t) => t.parentId === null);
      const childNodes = rm.topics.filter((t) => t.parentId !== null);

      for (const node of [...parentNodes, ...childNodes]) {
        activeTopicIds.add(node.id);
        await tx.roadmapTopic.upsert({
          where: { id: node.id },
          update: {
            roadmapId: rm.id,
            parentId: node.parentId,
            kind: node.kind,
            title: node.title,
            summary: node.summary,
            year: node.year,
            resourceFormat: node.resourceFormat,
            orderIndex: node.orderIndex,
            sourceUrl: node.sourceUrl,
            deprecatedAt: null,
          },
          create: {
            id: node.id,
            roadmapId: rm.id,
            parentId: node.parentId,
            kind: node.kind,
            title: node.title,
            summary: node.summary,
            year: node.year,
            resourceFormat: node.resourceFormat,
            orderIndex: node.orderIndex,
            sourceUrl: node.sourceUrl,
            deprecatedAt: null,
          },
        });
        topicsUpserted += 1;
      }
    }

    // Soft-deprecate roadmaps & topics from same repoUrl that disappeared in this snapshot
    const depRoadmaps = await tx.roadmap.updateMany({
      where: {
        source: { repoUrl: snapshot.repoUrl },
        id: { notIn: [...activeRoadmapIds] },
        deprecatedAt: null,
      },
      data: { deprecatedAt: now },
    });

    const depTopics = await tx.roadmapTopic.updateMany({
      where: {
        roadmap: { source: { repoUrl: snapshot.repoUrl } },
        id: { notIn: [...activeTopicIds] },
        deprecatedAt: null,
      },
      data: { deprecatedAt: now },
    });

    // Apply reviewed mappings (human-approved)
    const reviewedPairs = new Set<string>();
    let reviewedMappingsUpserted = 0;
    for (const m of reviewedMappings) {
      if (!activeTopicIds.has(m.topicId)) continue;
      reviewedPairs.add(`${m.topicId}::${m.tagCode}`);
      await tx.topicTagMap.upsert({
        where: { topicId_tagCode: { topicId: m.topicId, tagCode: m.tagCode } },
        update: {
          weight: m.weight,
          origin: m.origin,
          reviewedBy: m.reviewedBy,
          reviewedAt: m.reviewedBy ? now : null,
        },
        create: {
          topicId: m.topicId,
          tagCode: m.tagCode,
          weight: m.weight,
          origin: m.origin,
          reviewedBy: m.reviewedBy,
          reviewedAt: m.reviewedBy ? now : null,
        },
      });
      reviewedMappingsUpserted += 1;
    }

    // Add unreviewed auto suggestions ONLY for pairs not already reviewed
    let autoSuggestionsUpserted = 0;
    for (const s of autoSuggestions) {
      if (!activeTopicIds.has(s.topicId)) continue;
      const pairKey = `${s.topicId}::${s.tagCode}`;
      if (reviewedPairs.has(pairKey)) continue;

      await tx.topicTagMap.upsert({
        where: { topicId_tagCode: { topicId: s.topicId, tagCode: s.tagCode } },
        update: {}, // Never overwrite existing manual/reviewed entry
        create: {
          topicId: s.topicId,
          tagCode: s.tagCode,
          weight: s.weight,
          origin: 'auto',
          reviewedBy: null,
          reviewedAt: null,
        },
      });
      autoSuggestionsUpserted += 1;
    }

    return {
      sourceId: source.id,
      roadmapsUpserted: snapshot.roadmaps.length,
      topicsUpserted,
      roadmapsDeprecated: depRoadmaps.count,
      topicsDeprecated: depTopics.count,
      reviewedMappingsUpserted,
      autoSuggestionsUpserted,
    };
  });
}
