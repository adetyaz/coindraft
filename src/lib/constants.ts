// Client-accessible constants (not in src/lib/server/)

export interface Sector {
	id: string;
	name: string;
}

export const SECTORS: Sector[] = [
	{ id: 'l1', name: 'L1' },
	{ id: 'l2', name: 'L2' },
	{ id: 'defi', name: 'DeFi' },
	{ id: 'meme', name: 'Meme' },
	{ id: 'wildcard', name: 'Wildcard' }
];
