import { eq, and, asc, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { synthesisArtifacts, discoveryQuestions, discoveryResponses, onboardingParticipants } from "@paperclipai/db";
import type { SynthesisArtifact, SynthesisArtifactType, DiscoveryBucket } from "@paperclipai/shared";
import { notFound } from "../errors.js";

const STOPWORDS = new Set([
  "the", "a", "is", "and", "to", "in", "of", "for", "that", "it", "on", "with",
  "this", "are", "was", "be", "as", "at", "or", "an", "by", "we", "i", "my",
  "our", "they", "them", "their", "have", "has", "had", "do", "does", "not",
  "but", "from", "will", "would", "can", "could", "about", "all", "so", "if",
  "when", "what", "which", "how", "there", "been",
]);

const PAIN_KEYWORDS = [
  "slow", "manual", "tedious", "repetitive", "frustrating", "bottleneck",
  "delay", "waiting", "error", "mistake", "rework", "inefficient",
  "time-consuming", "overwhelming", "duplicate",
];

const ACTION_WORDS = [
  "manage", "create", "review", "send", "update", "track", "schedule",
  "coordinate", "prepare", "report", "analyze", "meet", "plan", "handle", "process",
];

const POSITIVE_AI_KEYWORDS = [
  "open", "willing", "excited", "ready", "interested", "curious",
  "helpful", "useful", "automate", "improve",
];

function getKeywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function keywordOverlap(a: string, b: string): number {
  const ka = getKeywords(a);
  const kb = getKeywords(b);
  if (ka.size === 0 || kb.size === 0) return 0;
  let shared = 0;
  for (const w of ka) {
    if (kb.has(w)) shared++;
  }
  return shared / Math.max(ka.size, kb.size);
}

export function synthesisService(db: Db) {

  async function runSynthesis(
    programId: string,
    artifactTypes?: SynthesisArtifactType[],
  ): Promise<SynthesisArtifact[]> {
    // Fetch all questions for the program
    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, programId))
      .orderBy(asc(discoveryQuestions.sequence));

    // Fetch all participants for the program
    const participants = await db.select().from(onboardingParticipants)
      .where(eq(onboardingParticipants.onboardingProgramId, programId));

    // Build question lookup
    const questionMap = new Map(questions.map(q => [q.id, q]));
    const questionIds = questions.map(q => q.id);

    // Fetch all responses for these questions
    type ResponseRow = typeof discoveryResponses.$inferSelect;
    let allResponses: ResponseRow[] = [];
    if (questionIds.length > 0) {
      allResponses = await db.select().from(discoveryResponses)
        .where(inArray(discoveryResponses.questionId, questionIds));
    }

    // Map: bucket -> responses
    const bucketResponses = new Map<string, ResponseRow[]>();
    for (const r of allResponses) {
      const q = questionMap.get(r.questionId);
      if (!q) continue;
      const bucket = q.bucket;
      if (!bucketResponses.has(bucket)) bucketResponses.set(bucket, []);
      bucketResponses.get(bucket)!.push(r);
    }

    // Map: participantId -> responses
    const participantResponses = new Map<string, ResponseRow[]>();
    for (const r of allResponses) {
      if (!participantResponses.has(r.participantId)) participantResponses.set(r.participantId, []);
      participantResponses.get(r.participantId)!.push(r);
    }

    const allTypes: SynthesisArtifactType[] = [
      "theme_summary", "contradiction_report", "workflow_map",
      "bottleneck_analysis", "opportunity_assessment", "full_synthesis",
    ];
    const typesToGenerate = artifactTypes ?? allTypes;

    const created: SynthesisArtifact[] = [];

    for (const aType of typesToGenerate) {
      let payload: Record<string, unknown> = {};
      let title = "";
      let summary = "";
      let confidence = 0;

      if (aType === "theme_summary") {
        const themes: { name: string; bucket: string; frequency: number; evidence: string[] }[] = [];
        let totalAvgLen = 0;
        let bucketCount = 0;

        for (const [bucket, responses] of bucketResponses) {
          const wordFreq = new Map<string, number>();
          const wordEvidence = new Map<string, string[]>();
          let totalLen = 0;

          for (const r of responses) {
            const words = r.rawText.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
            totalLen += r.rawText.length;
            for (const w of words) {
              wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
              if (!wordEvidence.has(w)) wordEvidence.set(w, []);
              const ev = wordEvidence.get(w)!;
              if (ev.length < 3 && !ev.includes(r.rawText)) {
                ev.push(r.rawText);
              }
            }
          }

          const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
          for (const [word, freq] of sorted) {
            themes.push({
              name: word,
              bucket,
              frequency: freq,
              evidence: wordEvidence.get(word) ?? [],
            });
          }

          if (responses.length > 0) {
            totalAvgLen += totalLen / responses.length;
            bucketCount++;
          }
        }

        confidence = bucketCount > 0 ? Math.min((totalAvgLen / bucketCount) / 200, 1.0) : 0;
        title = "Theme Summary";
        summary = `Identified ${themes.length} themes across ${bucketResponses.size} discovery buckets.`;
        payload = { themes };

      } else if (aType === "contradiction_report") {
        const contradictions: {
          questionId: string;
          participantIds: string[];
          summaryA: string;
          summaryB: string;
          confidence: number;
        }[] = [];

        // Group responses by question
        const byQuestion = new Map<string, ResponseRow[]>();
        for (const r of allResponses) {
          if (!byQuestion.has(r.questionId)) byQuestion.set(r.questionId, []);
          byQuestion.get(r.questionId)!.push(r);
        }

        for (const [qId, responses] of byQuestion) {
          if (responses.length < 2) continue;

          // Check all pairs for low keyword overlap
          let minOverlap = 1;
          let pairA: ResponseRow | null = null;
          let pairB: ResponseRow | null = null;

          for (let i = 0; i < responses.length; i++) {
            for (let j = i + 1; j < responses.length; j++) {
              const overlap = keywordOverlap(responses[i].rawText, responses[j].rawText);
              if (overlap < minOverlap) {
                minOverlap = overlap;
                pairA = responses[i];
                pairB = responses[j];
              }
            }
          }

          if (minOverlap < 0.2 && pairA && pairB) {
            contradictions.push({
              questionId: qId,
              participantIds: responses.map(r => r.participantId),
              summaryA: pairA.rawText.slice(0, 100),
              summaryB: pairB.rawText.slice(0, 100),
              confidence: 1 - minOverlap,
            });
          }
        }

        confidence = contradictions.length > 0
          ? contradictions.reduce((s, c) => s + c.confidence, 0) / contradictions.length
          : 0;
        title = "Contradiction Report";
        summary = `Found ${contradictions.length} potential contradictions across participant responses.`;
        payload = { contradictions };

      } else if (aType === "workflow_map") {
        const workflowResponses = bucketResponses.get("daily_workflow") ?? [];
        const workflows: { name: string; steps: string[]; participantIds: string[] }[] = [];

        // Group by participant
        const byParticipant = new Map<string, ResponseRow[]>();
        for (const r of workflowResponses) {
          if (!byParticipant.has(r.participantId)) byParticipant.set(r.participantId, []);
          byParticipant.get(r.participantId)!.push(r);
        }

        for (const [pid, responses] of byParticipant) {
          const name = responses[0]?.rawText.slice(0, 80) ?? "Unnamed workflow";
          const steps: string[] = [];

          for (const r of responses) {
            const sentences = r.rawText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
            for (const s of sentences) {
              const lower = s.toLowerCase();
              if (ACTION_WORDS.some(w => lower.includes(w))) {
                steps.push(s);
              }
            }
          }

          if (steps.length > 0) {
            workflows.push({ name, steps, participantIds: [pid] });
          }
        }

        confidence = workflows.length > 0 ? Math.min(workflows.length / 5, 1.0) : 0;
        title = "Workflow Map";
        summary = `Mapped ${workflows.length} workflows from daily workflow discovery responses.`;
        payload = { workflows };

      } else if (aType === "bottleneck_analysis") {
        const painResponses = bucketResponses.get("pain_points") ?? [];
        const bottlenecks: {
          description: string;
          frequency: number;
          affectedParticipantIds: string[];
          severity: "high" | "medium" | "low";
        }[] = [];

        // Count pain keyword occurrences
        const keywordCounts = new Map<string, { count: number; participants: Set<string> }>();
        for (const kw of PAIN_KEYWORDS) {
          keywordCounts.set(kw, { count: 0, participants: new Set() });
        }

        for (const r of painResponses) {
          const lower = r.rawText.toLowerCase();
          for (const kw of PAIN_KEYWORDS) {
            if (lower.includes(kw)) {
              const entry = keywordCounts.get(kw)!;
              entry.count++;
              entry.participants.add(r.participantId);
            }
          }
        }

        for (const [kw, data] of keywordCounts) {
          if (data.count === 0) continue;
          bottlenecks.push({
            description: kw,
            frequency: data.count,
            affectedParticipantIds: [...data.participants],
            severity: data.count >= 3 ? "high" : data.count === 2 ? "medium" : "low",
          });
        }

        bottlenecks.sort((a, b) => b.frequency - a.frequency);
        confidence = bottlenecks.length > 0 ? Math.min(bottlenecks.length / 10, 1.0) : 0;
        title = "Bottleneck Analysis";
        summary = `Identified ${bottlenecks.length} bottlenecks from pain point responses.`;
        payload = { bottlenecks };

      } else if (aType === "opportunity_assessment") {
        const painResponses = bucketResponses.get("pain_points") ?? [];
        const aiResponses = bucketResponses.get("ai_readiness") ?? [];

        // Build participantId -> ai_readiness text map
        const aiByParticipant = new Map<string, string>();
        for (const r of aiResponses) {
          const existing = aiByParticipant.get(r.participantId) ?? "";
          aiByParticipant.set(r.participantId, existing + " " + r.rawText);
        }

        const opportunities: {
          area: string;
          rationale: string;
          readinessScore: number;
          impactEstimate: "high" | "medium" | "low";
        }[] = [];

        // For each pain keyword found, cross-reference with AI readiness
        const painByKeyword = new Map<string, { participants: Set<string>; count: number }>();
        for (const r of painResponses) {
          const lower = r.rawText.toLowerCase();
          for (const kw of PAIN_KEYWORDS) {
            if (lower.includes(kw)) {
              if (!painByKeyword.has(kw)) painByKeyword.set(kw, { participants: new Set(), count: 0 });
              painByKeyword.get(kw)!.participants.add(r.participantId);
              painByKeyword.get(kw)!.count++;
            }
          }
        }

        for (const [kw, data] of painByKeyword) {
          // Compute readiness from corresponding participants' ai_readiness responses
          let totalPositive = 0;
          let totalWords = 0;

          for (const pid of data.participants) {
            const aiText = aiByParticipant.get(pid);
            if (!aiText) continue;
            const words = aiText.toLowerCase().split(/\W+/).filter(Boolean);
            totalWords += words.length;
            for (const w of words) {
              if (POSITIVE_AI_KEYWORDS.includes(w)) totalPositive++;
            }
          }

          const readinessScore = totalWords > 0 ? totalPositive / totalWords : 0;
          const impactEstimate: "high" | "medium" | "low" =
            data.count >= 3 ? "high" : data.count === 2 ? "medium" : "low";

          opportunities.push({
            area: kw,
            rationale: `${data.count} mention(s) across ${data.participants.size} participant(s)`,
            readinessScore,
            impactEstimate,
          });
        }

        opportunities.sort((a, b) => b.readinessScore - a.readinessScore);
        confidence = opportunities.length > 0
          ? opportunities.reduce((s, o) => s + o.readinessScore, 0) / opportunities.length
          : 0;
        title = "Opportunity Assessment";
        summary = `Assessed ${opportunities.length} AI integration opportunities.`;
        payload = { opportunities };

      } else if (aType === "full_synthesis") {
        // Combine top findings from all generated artifacts so far
        const keyFindings: string[] = [];
        const artifactSummaries: { type: string; count: number }[] = [];

        for (const a of created) {
          const p = a.payloadJson as Record<string, unknown>;
          artifactSummaries.push({
            type: a.artifactType,
            count: Array.isArray(p[Object.keys(p)[0]]) ? (p[Object.keys(p)[0]] as unknown[]).length : 0,
          });

          if (a.summary) keyFindings.push(a.summary);
        }

        const narrative = keyFindings.length > 0
          ? `Synthesis of ${participants.length} participants across ${questions.length} questions. ` +
            keyFindings.join(" ")
          : `No detailed findings available. ${participants.length} participants, ${questions.length} questions.`;

        confidence = keyFindings.length > 0 ? Math.min(keyFindings.length / 5, 1.0) : 0;
        title = "Full Synthesis";
        summary = `Combined synthesis across ${artifactSummaries.length} artifact types.`;
        payload = {
          narrative,
          keyFindings,
          responseCount: allResponses.length,
          participantCount: participants.length,
          artifactSummaries,
        };
      }

      const [row] = await db.insert(synthesisArtifacts).values({
        onboardingProgramId: programId,
        artifactType: aType,
        title,
        summary,
        payloadJson: payload,
        confidenceSummary: confidence,
      }).returning();

      created.push(row as unknown as SynthesisArtifact);
    }

    return created;
  }

  async function listArtifacts(programId: string): Promise<SynthesisArtifact[]> {
    const rows = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, programId))
      .orderBy(asc(synthesisArtifacts.artifactType));
    return rows as unknown as SynthesisArtifact[];
  }

  async function getArtifact(programId: string, id: string): Promise<SynthesisArtifact> {
    const [row] = await db.select().from(synthesisArtifacts)
      .where(and(
        eq(synthesisArtifacts.id, id),
        eq(synthesisArtifacts.onboardingProgramId, programId),
      ));
    if (!row) throw notFound("Synthesis artifact not found");
    return row as unknown as SynthesisArtifact;
  }

  async function clearArtifacts(programId: string): Promise<void> {
    await db.delete(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, programId));
  }

  return { runSynthesis, listArtifacts, getArtifact, clearArtifacts };
}
