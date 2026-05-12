import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { mainnet, arbitrum, base, polygon, optimism, sepolia, baseSepolia } from '@reown/appkit/networks';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PUBLIC_REOWN_PROJECT_ID } from '$env/static/public';

const PROJECT_ID = PUBLIC_REOWN_PROJECT_ID;

type AppKitInstance = ReturnType<typeof createAppKit>;

declare global {
	var __coindraftAppKit: AppKitInstance | undefined;
}

let instance: AppKitInstance | null = null;

if (typeof window !== 'undefined') {
	if (!globalThis.__coindraftAppKit) {
		const wagmiAdapter = new WagmiAdapter({
			projectId: PROJECT_ID,
			networks: [mainnet, sepolia, arbitrum, base, baseSepolia, polygon, optimism]
		});

		const solanaAdapter = new SolanaAdapter({
			wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
		});

		globalThis.__coindraftAppKit = createAppKit({
			projectId: PROJECT_ID,
			adapters: [wagmiAdapter, solanaAdapter],
			networks: [mainnet, sepolia, arbitrum, base, baseSepolia, polygon, optimism],
			metadata: {
				name: 'CoinDraft',
				description: 'Fantasy crypto draft platform',
				url: 'https://coindraft.io',
				icons: ['https://coindraft.io/icon.png']
			},
			features: {
				analytics: false,
				email: false,
				socials: false
			}
		});
	}

	instance = globalThis.__coindraftAppKit;
}

export const appKit = instance;
