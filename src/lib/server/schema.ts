import {
	pgTable,
	uuid,
	text,
	integer,
	numeric,
	boolean,
	timestamp,
	jsonb,
	date
} from 'drizzle-orm/pg-core';

// ─── Users (Wallet-based) ────────────────────────────────────────────────────

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	walletAddress: text('wallet_address').unique().notNull(), // primary identity
	chainType: text('chain_type').notNull(), // 'evm' | 'solana'
	username: text('username').unique().notNull(), // auto-generated, user can update
	xpTotal: integer('xp_total').default(0),
	streak: integer('streak').default(0),
	matchmakingStatus: text('matchmaking_status').default('idle'), // 'idle' | 'queued' | 'in_contest'
	activeBoosts: jsonb('active_boosts').default('[]'), // [{ sector, expiresAt }]
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

// ─── Leagues ──────────────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'public' | 'private'
	inviteCode: text('invite_code').unique(),
	createdBy: uuid('created_by').references(() => users.id),
	seasonStart: timestamp('season_start'),
	seasonEnd: timestamp('season_end'),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── League Members ───────────────────────────────────────────────────────────

export const leagueMembers = pgTable('league_members', {
	id: uuid('id').primaryKey().defaultRandom(),
	leagueId: uuid('league_id').references(() => leagues.id),
	userId: uuid('user_id').references(() => users.id),
	wins: integer('wins').default(0),
	losses: integer('losses').default(0),
	points: integer('points').default(0),
	joinedAt: timestamp('joined_at').defaultNow()
});

// ─── Gauntlet Questions ───────────────────────────────────────────────────────

export const gauntletQuestions = pgTable('gauntlet_questions', {
	id: uuid('id').primaryKey().defaultRandom(),
	question: text('question').notNull(),
	options: jsonb('options').notNull(), // [{ label, value }]
	correctAnswer: text('correct_answer').notNull(),
	sector: text('sector'), // which sector this relates to
	currencyId: text('currency_id'), // SoSoValue currency_id if token-specific
	xpReward: integer('xp_reward').default(50),
	boostSector: text('boost_sector'), // which draft slot gets boosted on correct answer
	activeDate: date('active_date').notNull(),
	createdAt: timestamp('created_at').defaultNow()
});

// ─── Gauntlet Attempts ────────────────────────────────────────────────────────

export const gauntletAttempts = pgTable('gauntlet_attempts', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id),
	questionId: uuid('question_id').references(() => gauntletQuestions.id),
	answer: text('answer').notNull(),
	correct: boolean('correct').notNull(),
	xpEarned: integer('xp_earned').default(0),
	attemptedAt: timestamp('attempted_at').defaultNow()
});
