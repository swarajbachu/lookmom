import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/schema.ts into ./migrations, which are then
// applied to D1 with `wrangler d1 migrations apply artifacts-db`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
