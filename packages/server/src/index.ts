import 'dotenv/config'; // loads packages/server/.env into process.env (cwd-relative)
import { loadConfig } from './config';
import { createProviders } from './composition';
import { createApp } from './http/app';
import { seedCorpus } from './seed';

// Fail fast on invalid configuration before binding the port.
const config = loadConfig();

// Composition root: construct and wire the application graph once.
const providers = createProviders(config);
const app = createApp(providers);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);

  // Seed the corpus + pre-run the Tyre↔RS13 report. Never let a seed failure
  // crash the server — log and continue.
  seedCorpus(providers)
    .then((result) => {
      console.log(
        `Seed complete: ${result.documents} documents ingested` +
          (result.gapReport ? '; Tyre↔RS13 gap report pre-run' : '; gap pre-run skipped'),
      );
    })
    .catch((err) => {
      console.error('Seed failed (continuing):', err instanceof Error ? err.message : err);
    });
});
