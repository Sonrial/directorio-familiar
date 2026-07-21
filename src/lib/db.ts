import { neon } from "@neondatabase/serverless";

let database: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está configurada");
  database = neon(url);
  return database;
}

