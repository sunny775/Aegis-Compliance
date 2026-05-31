import type { EmbeddingProvider } from './EmbeddingProvider';

/**
 * Local, in-process embeddings via `@xenova/transformers` (all-MiniLM-L6-v2):
 * $0, no extra key, deterministic (ARCHITECTURE.md §8.5). The model is loaded
 * once on first use and the pipeline is reused for every subsequent call.
 */

const MODEL = 'Xenova/all-MiniLM-L6-v2';

/** Minimal shape of the feature-extraction pipeline output tensor. */
interface PipelineTensor {
  data: Float32Array;
  dims: number[];
}

type FeatureExtractionPipeline = (
  texts: string | string[],
  options?: { pooling?: 'none' | 'mean' | 'cls'; normalize?: boolean },
) => Promise<PipelineTensor>;

interface TransformersModule {
  pipeline: (task: 'feature-extraction', model: string) => Promise<FeatureExtractionPipeline>;
}

// `@xenova/transformers` is ESM-only. This indirection performs a genuine
// dynamic import that survives CommonJS transpilation (a plain `import()` would
// be downleveled to `require()`), so the package loads natively at runtime.
const importTransformers = new Function(
  'return import("@xenova/transformers")',
) as () => Promise<TransformersModule>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  /** Load the model once; reuse the same pipeline across calls. */
  private getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = importTransformers().then((mod) =>
        mod.pipeline('feature-extraction', MODEL),
      );
    }
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getPipeline();
    // Mean pooling + L2 normalization yields one sentence vector per input.
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    return reshape(output.data, output.dims);
  }
}

/** Reshape a flat tensor buffer into one row per input text. */
function reshape(data: Float32Array, dims: number[]): number[][] {
  const rows = dims.length === 2 ? dims[0]! : 1;
  const cols = dims.length === 2 ? dims[1]! : dims[0]!;
  const result: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = new Array<number>(cols);
    for (let c = 0; c < cols; c++) {
      row[c] = data[r * cols + c]!;
    }
    result.push(row);
  }
  return result;
}
