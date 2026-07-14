export type ResultCardData = {
	username: string;
	didWin: boolean;
	yourScore: number;
	opponentScore: number;
	contestType: string;
	picks: Array<{ sector: string; pick: string; pct: number }>;
};

const SECTOR_COLOR: Record<string, string> = {
	l1: '#0F6E56',
	l2: '#2563EB',
	defi: '#534AB7',
	meme: '#993C1D',
	wildcard: '#D97706'
};

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders a 1200x630 OG-sized result card as an SVG string. */
export function renderResultCardSvg(data: ResultCardData): string {
	const bg = data.didWin ? '#0F6E56' : '#993C1D';
	const status = data.didWin ? 'YOU WON' : 'YOU LOST';
	const rowY = 320;
	const rowH = 52;

	const pickRows = data.picks
		.slice(0, 5)
		.map((p, i) => {
			const y = rowY + i * rowH;
			const color = SECTOR_COLOR[p.sector] ?? '#888780';
			const pct = p.pct >= 0 ? `+${p.pct.toFixed(1)}%` : `${p.pct.toFixed(1)}%`;
			const pctColor = p.pct >= 0 ? '#4ADE80' : '#FCA5A5';
			return `
				<rect x="60" y="${y}" width="1080" height="${rowH - 10}" rx="8" fill="rgba(255,255,255,0.08)" />
				<circle cx="95" cy="${y + 21}" r="14" fill="${color}" />
				<text x="120" y="${y + 27}" font-family="sans-serif" font-size="18" font-weight="700" fill="${color}">${esc(p.sector.toUpperCase())}</text>
				<text x="240" y="${y + 27}" font-family="sans-serif" font-size="20" font-weight="700" fill="white">${esc(p.pick)}</text>
				<text x="1080" y="${y + 27}" font-family="sans-serif" font-size="20" font-weight="700" fill="${pctColor}" text-anchor="end">${esc(pct)}</text>
			`;
		})
		.join('');

	return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="${bg}" />
				<stop offset="100%" stop-color="#0d0c18" />
			</linearGradient>
		</defs>
		<rect width="1200" height="630" fill="url(#bg)" />
		<text x="60" y="80" font-family="sans-serif" font-size="24" font-weight="700" fill="rgba(255,255,255,0.6)" letter-spacing="2">COINDRAFT · ${esc(data.contestType.toUpperCase())} CONTEST</text>
		<text x="60" y="160" font-family="sans-serif" font-size="72" font-weight="900" fill="white">${esc(status)}</text>
		<text x="60" y="210" font-family="sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.85)">${esc(data.username)} · ${data.yourScore} - ${data.opponentScore}</text>
		${pickRows}
		<text x="60" y="600" font-family="sans-serif" font-size="20" font-weight="600" fill="rgba(255,255,255,0.5)">coindraft.app</text>
	</svg>`;
}
