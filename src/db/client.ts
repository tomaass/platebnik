import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// `next build` collects page data without DATABASE_URL set (e.g. for the
// dynamic OG-image route that imports the db). neon() throws on a missing
// string, so fall back to a placeholder at build time — it's never connected
// because dynamic routes don't run queries during collection. Real requests
// always run with DATABASE_URL set.
const sql = neon(process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost/placeholder')
export const db = drizzle(sql, { schema })
