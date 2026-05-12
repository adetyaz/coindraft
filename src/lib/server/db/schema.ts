import { pgTable, uuid, text, integer, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').unique().notNull(),
	username: text('username').unique().notNull(),
	password: text('password').notNull(), // bcrypt hash
	xpTotal: integer('xp_total').default(0),
	streak: integer('streak').default(0),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── Contests ─────────────────────────────────────────────────────────────────
// One contest = one head-to-head match between two users
// user_a = the human, user_b = bot (Wave 1) or real opponent (Wave 2)

export const contests = pgTable('contests', {
	id: uuid('id').primaryKey().defaultRandom(),
	userAId: uuid('user_a_id').references(() => users.id),
	userBId: uuid('user_b_id').references(() => users.id),
	type: text('type').default('daily'), // 'daily' | 'weekly'
	status: text('status').default('open'), // 'open' | 'live' | 'resolved'
	startAt: timestamp('start_at'),
	endAt: timestamp('end_at'),
	winnerId: uuid('winner_id').references(() => users.id)
});

// ─── Lineups ──────────────────────────────────────────────────────────────────
// Each contest has two lineups — one per player

export const lineups = pgTable('lineups', {
	id: uuid('id').primaryKey().defaultRandom(),
	contestId: uuid('contest_id').references(() => contests.id),
	userId: uuid('user_id').references(() => users.id),
	locked: boolean('locked').default(false),
	finalScore: numeric('final_score').default('0'),
	breakdown: text('breakdown') // pre-generated AI text (for seeded contests)
});

// ─── Lineup Picks ─────────────────────────────────────────────────────────────
// 5 rows per lineup — one per draft slot

export const lineupPicks = pgTable('lineup_picks', {
	id: uuid('id').primaryKey().defaultRandom(),
	lineupId: uuid('lineup_id').references(() => lineups.id),
	tokenSymbol: text('token_symbol').notNull(), // 'SOL', 'PEPE'
	tokenName: text('token_name').notNull(), // 'Solana', 'Pepe'
	sector: text('sector').notNull(), // 'L1' | 'L2' | 'Meme' | 'DeFi' | 'Wildcard'
	currencyId: text('currency_id').notNull(), // SoSoValue currency_id (string of long int)
	entryPrice: numeric('entry_price'), // price at lineup lock time
	exitPrice: numeric('exit_price'), // price at contest resolution
	pctChange: numeric('pct_change'), // ((exit - entry) / entry) * 100
	score: numeric('score').default('0') // weighted score for this pick
});
