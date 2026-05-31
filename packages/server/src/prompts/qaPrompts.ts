/**
 * Prompts for grounded retrieval-augmented Q&A (ARCHITECTURE.md §6, §8.4). The
 * system instruction is the stable, prompt-cached prefix; the user message
 * carries the retrieved evidence and the question.
 */

/** The grounding contract: answer only from retrieved evidence, cite it, or decline. */
export const QA_SYSTEM = [
  'You are a compliance assistant answering questions about ONE specific Queensland coal-mining document.',
  'Answer using ONLY the numbered evidence passages in the user message — do not use outside knowledge.',
  'Every claim must be supported by that evidence, and you must cite the supporting passage(s) inline by',
  'clause reference and page, e.g. "(§8.5, p.3)".',
  'If the evidence does not contain the answer, reply exactly: "The provided document does not contain',
  'information to answer this question." — do not guess or fill gaps from general knowledge.',
  'Be concise and factual.',
].join(' ');

/** The canned, grounded response used when no evidence is available. */
export const NO_EVIDENCE_ANSWER =
  'The provided document does not contain information to answer this question.';

export interface EvidencePassage {
  clauseRef: string;
  page: number;
  text: string;
}

/** Build the user message: numbered, citable evidence followed by the question. */
export function buildQAUserMessage(question: string, passages: EvidencePassage[]): string {
  const evidence = passages
    .map((p, i) => {
      const anchor = p.clauseRef ? `§${p.clauseRef}, p.${p.page}` : `p.${p.page}`;
      return `[Passage ${i + 1} — ${anchor}]\n${p.text}`;
    })
    .join('\n\n');

  return [
    'Evidence passages:',
    '',
    evidence,
    '',
    `Question: ${question}`,
    '',
    'Answer using only the evidence above, citing passages by clause and page.',
  ].join('\n');
}
