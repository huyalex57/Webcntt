import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

export interface IngestConfig {
  repoUrl: string;
  webUrl: string;
  commitSha: string;
  readmeFile: string;
  licenseFile: string;
  licenseName: string;
  licenseOption: 'A' | 'B' | 'C';
  expectedLicenseSha256: string;
  attribution: string;
  allowedSections: string[];
}

export interface NormalizedTopicNode {
  id: string;
  parentId: string | null;
  kind: 'topic' | 'subtopic';
  title: string;
  summary: string | null;
  year: number | null;
  resourceFormat: string | null;
  orderIndex: number;
  sourceUrl: string;
}

export interface NormalizedRoadmap {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  orderIndex: number;
  sourceUrl: string;
  topics: NormalizedTopicNode[];
}

export interface NormalizedRoadmapSnapshot {
  schemaVersion: 1;
  repoUrl: string;
  webUrl: string;
  commitSha: string;
  licenseSha256: string;
  licenseName: string;
  licenseOption: 'A' | 'B' | 'C';
  attribution: string;
  snapshotChecksum: string;
  roadmaps: NormalizedRoadmap[];
}

export interface ReviewedTagMappingRow {
  topicId: string;
  tagCode: string;
  weight: number;
  origin: 'manual' | 'auto';
  reviewedBy: string | null;
}

export class LicenseVerificationError extends Error {
  readonly code = 'LICENSE_VERIFICATION_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'LicenseVerificationError';
  }
}

export class SnapshotValidationError extends Error {
  readonly code = 'SNAPSHOT_SCHEMA_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotValidationError';
  }
}

export function slugify(input: string, maxLen: number = 56): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+\+/g, 'pp')
    .replace(/c#/g, 'csharp')
    .replace(/\.net/g, 'dotnet')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return (normalized || 'item').slice(0, maxLen).replace(/-+$/g, '') || 'item';
}

export function sha256Hex(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function verifyLicenseFile(repoDir: string, config: IngestConfig): string {
  const licensePath = path.join(repoDir, config.licenseFile);
  if (!fs.existsSync(licensePath)) {
    throw new LicenseVerificationError(
      `Missing license file "${config.licenseFile}" in repository ${repoDir}`
    );
  }
  const actualSha = sha256Hex(fs.readFileSync(licensePath));
  if (actualSha !== config.expectedLicenseSha256) {
    throw new LicenseVerificationError(
      `License SHA-256 mismatch for "${config.licenseFile}": expected ${config.expectedLicenseSha256}, got ${actualSha}. Refusing to ingest until license change is reviewed.`
    );
  }
  return actualSha;
}

function stripHtmlAndBadges(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYearFromLine(line: string): number | null {
  const match = line.match(/alt="Year\s+(\d{4})"/i) ?? line.match(/Year-(\d{4})-/i);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 1990 && year <= 2100 ? year : null;
}

function extractFormatFromLine(line: string): string | null {
  const formats: Array<[RegExp, string]> = [
    [/Format-Course/i, 'Course'],
    [/Format-Book/i, 'Book'],
    [/Format-PDF/i, 'PDF'],
    [/Format-Website/i, 'Interactive Website'],
    [/Blog-Article/i, 'Blog Article'],
    [/Medium-Article/i, 'Article'],
    [/GitHub-Repo/i, 'GitHub Repo'],
  ];
  for (const [re, label] of formats) {
    if (re.test(line)) return label;
  }
  return null;
}

/**
 * Extracts explicit comma-separated skill facets from a description's
 * "covering / spanning / across ..." clause (verbatim from 0PL text, no fabrication).
 */
function extractSubtopicLabels(summary: string): string[] {
  const clauseMatch = summary.match(
    /\b(?:covering|spanning|across)\s+([^.]+?)(?:\.|,\s*with\b|\s+with\s+(?:interactive|annotated|staged|practical|supporting)\b|$)/i
  );
  if (!clauseMatch) return [];

  const rawClause = clauseMatch[1];
  const parts = rawClause
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map((p) => p.trim().replace(/^and\s+/i, '').replace(/[.,;:]+$/, ''))
    .filter((p) => p.length >= 2 && p.length <= 48 && !/^\d+$/.test(p));

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = slugify(p, 36);
    if (!seen.has(key) && key !== 'item') {
      seen.add(key);
      deduped.push(p);
    }
    if (deduped.length >= 6) break;
  }

  return deduped.length >= 2 ? deduped : [];
}

const schemaPath = path.join(__dirname, 'schema', 'roadmap-snapshot.v1.json');
const snapshotSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validateSnapshotFn = ajv.compile<NormalizedRoadmapSnapshot>(snapshotSchema);

export function validateSnapshot(snapshot: NormalizedRoadmapSnapshot): void {
  if (!validateSnapshotFn(snapshot)) {
    const details = (validateSnapshotFn.errors ?? [])
      .map((e) => `${e.instancePath || '/'}: ${e.message}`)
      .join('; ');
    throw new SnapshotValidationError(`Normalized roadmap snapshot failed JSON Schema: ${details}`);
  }
}

/**
 * Parses `liuchong/awesome-roadmaps` README.md into a normalized, schema-validated
 * roadmap -> topic -> subtopic snapshot with stable deterministic IDs.
 */
export function parseAwesomeRoadmapsMarkdown(
  markdown: string,
  config: IngestConfig,
  verifiedLicenseSha256: string
): NormalizedRoadmapSnapshot {
  const allowedSet = new Set(config.allowedSections);
  const lines = markdown.split(/\r?\n/);

  const roadmaps: NormalizedRoadmap[] = [];
  let currentRoadmap: NormalizedRoadmap | null = null;
  let lastTopLevelTopic: NormalizedTopicNode | null = null;
  const usedTopicIds = new Set<string>();

  const makeUniqueId = (baseId: string): string => {
    if (!usedTopicIds.has(baseId)) {
      usedTopicIds.add(baseId);
      return baseId;
    }
    let suffix = 2;
    while (usedTopicIds.has(`${baseId}-${suffix}`)) {
      suffix += 1;
    }
    const unique = `${baseId}-${suffix}`;
    usedTopicIds.add(unique);
    return unique;
  };

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      const headingTitle = stripHtmlAndBadges(headingMatch[1]);
      const sectionSlug = slugify(headingTitle, 64);

      if (
        sectionSlug === 'contents' ||
        sectionSlug === 'license' ||
        !allowedSet.has(sectionSlug)
      ) {
        currentRoadmap = null;
        lastTopLevelTopic = null;
        continue;
      }

      currentRoadmap = {
        id: `rm:${sectionSlug}`,
        slug: sectionSlug,
        title: headingTitle,
        description: `Danh mục lộ trình ${headingTitle} (nguồn: liuchong/awesome-roadmaps, 0PL).`,
        orderIndex: roadmaps.length,
        sourceUrl: `${config.webUrl}#${sectionSlug}`,
        topics: [],
      };
      roadmaps.push(currentRoadmap);
      lastTopLevelTopic = null;
      continue;
    }

    if (!currentRoadmap) continue;

    // Nested markdown sub-bullet (if present in future snapshots)
    const nestedMatch = rawLine.match(/^\s{2,}[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/);
    if (nestedMatch && lastTopLevelTopic) {
      const subTitle = stripHtmlAndBadges(nestedMatch[1]);
      const subUrl = nestedMatch[2].trim();
      const subSummary = stripHtmlAndBadges(nestedMatch[3].replace(/^\s*[-–—:]\s*/, '')) || null;
      const subSlug = slugify(subTitle, 40);
      const subId = makeUniqueId(`${lastTopLevelTopic.id}:${subSlug}`);
      const siblingCount = currentRoadmap.topics.filter(
        (t) => t.parentId === lastTopLevelTopic!.id
      ).length;

      currentRoadmap.topics.push({
        id: subId,
        parentId: lastTopLevelTopic.id,
        kind: 'subtopic',
        title: subTitle.slice(0, 200),
        summary: subSummary ? subSummary.slice(0, 600) : null,
        year: extractYearFromLine(rawLine),
        resourceFormat: extractFormatFromLine(rawLine),
        orderIndex: siblingCount,
        sourceUrl: subUrl,
      });
      continue;
    }

    // Top-level bullet entry: - [Title](https://...) - Description <img ...>
    const bulletMatch = rawLine.match(/^[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/);
    if (!bulletMatch) continue;

    const title = stripHtmlAndBadges(bulletMatch[1]);
    const url = bulletMatch[2].trim();
    const rest = bulletMatch[3] ?? '';
    const cleanedSummary = stripHtmlAndBadges(rest.replace(/^\s*[-–—:]\s*/, ''));
    const entrySlug = slugify(title, 56);
    const topicId = makeUniqueId(`rm:${currentRoadmap.slug}:${entrySlug}`);
    const topOrderIndex = currentRoadmap.topics.filter((t) => t.parentId === null).length;

    const topicNode: NormalizedTopicNode = {
      id: topicId,
      parentId: null,
      kind: 'topic',
      title: title.slice(0, 200),
      summary: cleanedSummary ? cleanedSummary.slice(0, 600) : null,
      year: extractYearFromLine(rawLine),
      resourceFormat: extractFormatFromLine(rawLine),
      orderIndex: topOrderIndex,
      sourceUrl: url,
    };
    currentRoadmap.topics.push(topicNode);
    lastTopLevelTopic = topicNode;

    // Extract explicit subtopics from description facets ("covering X, Y, and Z")
    if (cleanedSummary) {
      const facets = extractSubtopicLabels(cleanedSummary);
      facets.forEach((facetLabel, idx) => {
        const subSlug = slugify(facetLabel, 36);
        const subId = makeUniqueId(`${topicId}:${subSlug}`);
        currentRoadmap!.topics.push({
          id: subId,
          parentId: topicId,
          kind: 'subtopic',
          title: facetLabel.slice(0, 200),
          summary: null,
          year: null,
          resourceFormat: null,
          orderIndex: idx,
          sourceUrl: url,
        });
      });
    }
  }

  const snapshotChecksum = sha256Hex(JSON.stringify(roadmaps));

  const snapshot: NormalizedRoadmapSnapshot = {
    schemaVersion: 1,
    repoUrl: config.repoUrl,
    webUrl: config.webUrl,
    commitSha: config.commitSha,
    licenseSha256: verifiedLicenseSha256,
    licenseName: config.licenseName,
    licenseOption: config.licenseOption,
    attribution: config.attribution,
    snapshotChecksum,
    roadmaps,
  };

  validateSnapshot(snapshot);
  return snapshot;
}

const KEYWORD_TO_CORE_TOPIC: Array<[RegExp, string]> = [
  [/\b(sql|database|databases|data engineer|data analytics|data analyst|postgres|mysql)\b/i, 'CSDL'],
  [/\b(algorithm|data structure|coding interview|mathematics|math|competitive|cpp|c\+\+)\b/i, 'CTDL'],
  [/\b(java|oop|object[- ]oriented|design pattern|software architect|software design|asp\.net|flutter|android|ios|game|rust|go developer|golang|php)\b/i, 'OOP'],
  [/\b(security|cybersecurity|network|networking|hacker|pentest|dfir|forensic|vulnerability|devsecops)\b/i, 'MANG'],
  [/\b(linux|operating system|embedded|fpga|asic|systems|system design|concurrency|vm lifecycle)\b/i, 'HDH'],
  [/\b(ai|machine learning|deep learning|data scien|llm|nlp|agent|agentic|rag|mlops|pytorch)\b/i, 'AI_DS'],
  [/\b(web|frontend|backend|full[- ]?stack|react|vue|angular|node\.js|laravel|devops|cloud|platform engineering|docker|kubernetes|ci\/cd|ui\/ux|qa|quality assurance)\b/i, 'WEB_CLOUD'],
];

/**
 * Generates automatic unreviewed keyword tag suggestions for any top-level roadmap topic.
 */
export function suggestAutoTagMappings(
  snapshot: NormalizedRoadmapSnapshot
): ReviewedTagMappingRow[] {
  const suggestions: ReviewedTagMappingRow[] = [];
  for (const rm of snapshot.roadmaps) {
    for (const topic of rm.topics) {
      if (topic.kind !== 'topic') continue;
      const haystack = `${rm.title} ${topic.title} ${topic.summary ?? ''}`;
      const matched = new Set<string>();
      for (const [re, coreTag] of KEYWORD_TO_CORE_TOPIC) {
        if (re.test(haystack)) matched.add(coreTag);
      }
      for (const tagCode of matched) {
        suggestions.push({
          topicId: topic.id,
          tagCode,
          weight: 0.8,
          origin: 'auto',
          reviewedBy: null,
        });
      }
    }
  }
  return suggestions;
}

/**
 * Loads human-reviewed CSV mapping (`topic_id,tag_code,weight,origin,reviewed_by`).
 */
export function loadReviewedMappingsCsv(csvPath: string): ReviewedTagMappingRow[] {
  if (!fs.existsSync(csvPath)) return [];
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const rows: ReviewedTagMappingRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.toLowerCase().startsWith('topic_id,')) continue;
    const [topicId, tagCode, weightStr, originStr, reviewedBy] = line.split(',').map((s) => s.trim());
    if (!topicId || !tagCode) continue;
    const weight = Number(weightStr || '1');
    rows.push({
      topicId,
      tagCode,
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1.0,
      origin: originStr === 'auto' ? 'auto' : 'manual',
      reviewedBy: reviewedBy || 'curriculum-reviewer',
    });
  }
  return rows;
}
