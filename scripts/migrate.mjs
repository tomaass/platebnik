// Applies pending Drizzle migrations. Runs in the Vercel build step before
// `next build` (see package.json "vercel-build").
//
// - Guards on DATABASE_URL so builds without a database (misconfigured envs)
//   skip gracefully instead of failing on "required params".
// - Uses the serverless Pool over WebSocket against the DIRECT (unpooled)
//   endpoint. Migrations run inside a transaction, which the PgBouncer pooler
//   (-pooler host) can't support — that's why drizzle-kit migrate failed in
//   production. Node 22+ exposes a global WebSocket, so no `ws` dependency.
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('DATABASE_URL not set — skipping migrations.')
  process.exit(0)
}

const directUrl = url.replace('-pooler.', '.')
const pool = new Pool({ connectionString: directUrl })

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log('Migrations up to date.')
} finally {
  await pool.end()
}
