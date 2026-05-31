import 'dotenv/config'; // loads packages/server/.env into process.env (cwd-relative)
import express from 'express';
import cors from 'cors';
import { loadConfig } from './config';
import { createProviders } from './composition';
import { errorMiddleware } from './http/errorMiddleware';

// Fail fast on invalid configuration before binding the port.
const config = loadConfig();

// Composition root: construct and wire the provider layer once. Services that
// consume these are added in later phases. (No model download happens here —
// the embedding pipeline loads lazily on first use.)
const providers = createProviders(config);

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error middleware must be registered last.
app.use(errorMiddleware);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`Provider layer wired: ${Object.keys(providers).join(', ')}`);
});
