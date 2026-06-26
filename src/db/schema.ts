import {
  boolean, integer, jsonb, pgTable, primaryKey, text, timestamp,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  bankAccountRaw: text('bank_account_raw'),
  bankAccountIban: text('bank_account_iban'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const boards = pgTable('boards', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  currency: text('currency').notNull().default('CZK'),
  variableSymbol: text('variable_symbol').notNull(),
  tipPercents: jsonb('tip_percents').$type<number[]>().notNull().default([0, 5, 10]),
  theme: text('theme').notNull().default('sunset'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const items = pgTable('items', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.token, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceHaler: integer('price_haler').notNull(),
  position: integer('position').notNull().default(0),
})

export const contributions = pgTable('contributions', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.token, { onDelete: 'cascade' }),
  name: text('name'),
  message: text('message'),
  selectionSnapshot: jsonb('selection_snapshot').notNull(),
  amountHaler: integer('amount_haler').notNull(),
  tipHaler: integer('tip_haler').notNull(),
  paid: boolean('paid').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// --- Auth.js (NextAuth) tabulky ---
export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }))

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }))
