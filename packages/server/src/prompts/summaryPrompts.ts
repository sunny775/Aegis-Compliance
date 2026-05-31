import { z } from 'zod';
import type { JsonSchema } from '../providers/LLMProvider';

/**
 * Prompts for summarization and key-point extraction. Role-framed system
 * instructions (the stable, prompt-cached prefix — §8.3) live here alongside the
 * explicit output schema, so prompt wording and structure are reviewed together.
 */

/** Single-pass plain-English summary for a non-expert reader. */
export const SUMMARY_SYSTEM = [
  'You are a compliance analyst who explains Queensland coal-mining safety documents to a non-expert reader.',
  'Write a clear, plain-English summary of the document provided in the user message.',
  'Cover what the document is for, who it applies to, and the main controls or obligations it sets out.',
  'Use short paragraphs and everyday language; avoid jargon, and never invent content that is not in the text.',
  'Output only the summary prose — no preamble, headings, or bullet markup.',
].join(' ');

/** Map step: summarize one section of a larger document. */
export const SECTION_SUMMARY_SYSTEM = [
  'You are summarizing ONE section of a larger Queensland coal-mining compliance document.',
  'Produce a faithful 2–4 sentence plain-English summary of just this section.',
  'This partial summary will later be combined with others, so do not add document-level framing.',
  'Do not invent content. Output only the summary prose.',
].join(' ');

/** Reduce step: synthesize section summaries into one document summary. */
export const SYNTHESIS_SYSTEM = [
  'You are given several section summaries of a single Queensland coal-mining compliance document.',
  'Synthesize them into one coherent, plain-English summary for a non-expert reader.',
  'Remove redundancy, keep the overall purpose and the main controls, and preserve accuracy.',
  'Output only the summary prose — no preamble or headings.',
].join(' ');

/** Key-point extraction. Source chunks are prefixed with [§clause p.N] anchors. */
export const KEY_POINTS_SYSTEM = [
  'You extract the key points and topics of a Queensland coal-mining compliance document.',
  'Return them by calling the record_key_points tool — do not write prose.',
  'Each key point is one concise, self-contained sentence capturing an important obligation, control, or topic.',
  'The source text is annotated with [§clauseRef p.N] anchors; when a key point comes from an anchored passage,',
  'set clauseRef and page to that anchor. Never invent a clause reference or page that is not shown.',
  'Produce at most 12 key points for a section; prioritise the most safety-significant.',
].join(' ');

/** Zod schema — the defensive guard applied to the tool output (§8.2). */
export const keyPointSchema = z.object({
  text: z.string().min(1),
  clauseRef: z.string().optional(),
  page: z.number().int().positive().optional(),
});
export const keyPointsResultSchema = z.object({
  keyPoints: z.array(keyPointSchema),
});

/** JSON Schema used as the tool's input_schema (forces structured output). */
export const keyPointsJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['keyPoints'],
  properties: {
    keyPoints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'One concise key point.' },
          clauseRef: { type: 'string', description: 'Originating clause, e.g. "8.5" (omit if none).' },
          page: { type: 'integer', description: 'Originating page number (omit if unknown).' },
        },
      },
    },
  },
};

export const KEY_POINTS_TOOL_NAME = 'record_key_points';
export const KEY_POINTS_TOOL_DESCRIPTION = 'Record the extracted key points in the required schema.';
