import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Placeholder until a Neon (or local) Postgres is provisioned; the app
    // only needs a live DB for social features, not core gameplay.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/x",
  },
});
