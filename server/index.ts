import { analyze, LensiskuClient, SqliteDictionaryCache } from "../src/index.js";
import { createApp } from "./app.js";

const cache = new SqliteDictionaryCache(process.env.CACHE_PATH ? { filePath: process.env.CACHE_PATH } : undefined);
const client = new LensiskuClient();

const app = createApp((text) => analyze(text, { cache, client }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`jbolaltci listening on http://localhost:${port}`);
});
