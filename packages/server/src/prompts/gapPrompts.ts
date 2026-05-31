import { z } from 'zod';
import type { JsonSchema } from '../providers/LLMProvider';
import type { Requirement } from '../domain/types';

/**
 * Prompts for the requirements-coverage-matrix gap analysis (ARCHITECTURE.md §7).
 * The classification system prompt is a large, stable rubric reused across every
 * per-requirement call — it is the prompt-cache prefix that makes the engine
 * cheap (§8.3). Output is forced through tool-use JSON and re-validated with Zod.
 */

// ── Step 1: requirement extraction ──────────────────────────────────────────

export const REQUIREMENT_EXTRACTION_SYSTEM = [
  'You are a compliance auditor extracting discrete, atomic requirements from a Queensland',
  'Recognised Standard. From the single section provided, extract each distinct control or',
  'obligation (the must / shall / should statements). Return them via the record_requirements tool.',
  'For each requirement: write a self-contained sentence; set clauseRef and page from the',
  '[§clause p.N] anchors shown in the text; and give a short category (e.g. "Inflation safety",',
  '"Storage", "Competency"). Extract only what the text states — never invent requirements,',
  'clause references, or pages.',
].join(' ');

export const requirementItemSchema = z.object({
  text: z.string().min(1),
  clauseRef: z.string(),
  page: z.number().int().positive(),
  category: z.string(),
});
export const requirementsResultSchema = z.object({
  // Default to [] so a section the model returns no requirements for doesn't fail validation.
  requirements: z.array(requirementItemSchema).default([]),
});

export const requirementsJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requirements'],
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'clauseRef', 'page', 'category'],
        properties: {
          text: { type: 'string', description: 'Self-contained requirement sentence.' },
          clauseRef: { type: 'string', description: 'Originating clause, e.g. "4.5".' },
          page: { type: 'integer', description: 'Originating page number.' },
          category: { type: 'string', description: 'Short topical category.' },
        },
      },
    },
  },
};

export const REQUIREMENTS_TOOL_NAME = 'record_requirements';
export const REQUIREMENTS_TOOL_DESCRIPTION = 'Record the extracted requirements in the required schema.';

// ── Step 3: coverage classification ─────────────────────────────────────────

export const GAP_CLASSIFICATION_SYSTEM = [
  'You are a compliance auditor judging whether a site PROCEDURE covers ONE requirement drawn',
  'from a Recognised Standard. You are given the requirement and the procedure evidence passages',
  'retrieved for it. Judge coverage based ONLY on the provided evidence — never use outside knowledge.',
  '',
  'status:',
  '- FULL: the procedure clearly and completely addresses the requirement.',
  '- PARTIAL: the procedure addresses it only incompletely or weakly.',
  '- MISSING: the evidence does not address the requirement, or no relevant evidence was provided.',
  'If no passage is relevant you MUST return MISSING with procedureEvidenceIndex 0.',
  '',
  'severity reflects the SAFETY RISK if this requirement were not met — NOT merely whether matching',
  'text is absent. A missing exclusion-zone or tyre-inflation control is Critical; a missing',
  'documentation or records-retention detail is Low. Recognised standards are guidance, so frame this',
  'as coverage of a recognised control, not a violation.',
  '',
  'procedureEvidenceIndex: the 1-based number of the single passage that best supports your verdict,',
  'or 0 if none. evidenceQuote: a short verbatim quote from that passage (empty string if 0).',
  'rationale: one or two sentences grounded in the evidence. recommendedAction: a concrete step to',
  'close or strengthen coverage. Return the verdict via the record_gap_verdict tool.',
].join('\n');

export const gapVerdictResultSchema = z.object({
  status: z.enum(['FULL', 'PARTIAL', 'MISSING']),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
  procedureEvidenceIndex: z.number().int().min(0),
  evidenceQuote: z.string(),
  rationale: z.string(),
  recommendedAction: z.string(),
});

export const gapVerdictJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'severity', 'procedureEvidenceIndex', 'evidenceQuote', 'rationale', 'recommendedAction'],
  properties: {
    status: { type: 'string', enum: ['FULL', 'PARTIAL', 'MISSING'] },
    severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
    procedureEvidenceIndex: {
      type: 'integer',
      description: '1-based index of the supporting passage, or 0 if none is relevant.',
    },
    evidenceQuote: { type: 'string', description: 'Verbatim quote from the cited passage ("" if index 0).' },
    rationale: { type: 'string' },
    recommendedAction: { type: 'string' },
  },
};

export const GAP_VERDICT_TOOL_NAME = 'record_gap_verdict';
export const GAP_VERDICT_TOOL_DESCRIPTION = 'Record the coverage verdict in the required schema.';

// ── User-message builders ────────────────────────────────────────────────────

export function buildExtractionUserMessage(standardTitle: string, sectionText: string): string {
  return [
    `Standard: ${standardTitle}`,
    '',
    'Section text (each passage is prefixed with its [§clause p.N] anchor):',
    '',
    sectionText,
    '',
    'Extract the discrete requirements stated in this section.',
  ].join('\n');
}

export interface GapEvidencePassage {
  clauseRef: string;
  page: number;
  text: string;
}

export function buildClassificationUserMessage(
  requirement: Requirement,
  passages: GapEvidencePassage[],
): string {
  const evidence =
    passages.length === 0
      ? '(no relevant procedure text was retrieved)'
      : passages
          .map((p, i) => {
            const anchor = p.clauseRef ? `§${p.clauseRef}, p.${p.page}` : `p.${p.page}`;
            return `[Passage ${i + 1} — ${anchor}]\n${p.text}`;
          })
          .join('\n\n');

  return [
    `Requirement (Standard §${requirement.clauseRef}, p.${requirement.page}): ${requirement.text}`,
    `Category: ${requirement.category}`,
    '',
    'Procedure evidence passages:',
    '',
    evidence,
    '',
    'Judge how well the procedure covers this requirement.',
  ].join('\n');
}
