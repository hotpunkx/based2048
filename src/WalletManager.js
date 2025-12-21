import { createWalletClient, custom, createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const CONTRACT_ADDRESS = "0xB59C8cD194221645a8C8e8b2398C8Fa176A5EaE1";
const MINIMAL_ABI = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function mint() public"
]);

export class WalletManager {
    constructor() {
        this.walletClient = null;
        this.publicClient = null;
        this.account = null;
        this.chainId = 8453; // Base Mainnet

        // Event listeners
        this.onAccountChange = null;
    }

    async init() {
        if (!window.ethereum) return false;

        this.walletClient = createWalletClient({
            chain: base,
            transport: custom(window.ethereum)
        });

        this.publicClient = createPublicClient({
            chain: base,
            transport: http()
        });

        // Setup listeners
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                this.account = accounts[0];
                if (this.onAccountChange) this.onAccountChange(this.account);
            } else {
                this.account = null;
                if (this.onAccountChange) this.onAccountChange(null);
            }
        });

        window.ethereum.on('chainChanged', () => window.location.reload());

        // Auto-connect attempt
        try {
            const accounts = await this.walletClient.requestAddresses();
            if (accounts.length > 0) {
                this.account = accounts[0];
                await this.checkNetwork();
                return this.account;
            }
        } catch (e) {
            console.log("Auto-connect failed/rejected");
        }
        return null;
    }

    async connect() {
        if (!window.ethereum) {
            alert("No wallet found. Please install Coinbase Wallet or MetaMask.");
            return null;
        }

        try {
            const accounts = await this.walletClient.requestAddresses();
            this.account = accounts[0];
            await this.checkNetwork();
            return this.account;
        } catch (error) {
            console.error("Connection failed:", error);
            throw error;
        }
    }

    async checkNetwork() {
        if (!window.ethereum) return;
        const chainId = await this.walletClient.getChainId();
        if (chainId !== this.chainId) {
            await this.switchNetwork();
        }
    }

    async switchNetwork() {
        try {
            await this.walletClient.switchChain({ id: this.chainId });
        } catch (error) {
            if (error.code === 4902) {
                await this.walletClient.addChain({ chain: base });
            } else {
                throw error;
            }
        }
    }

    getAccount() {
        return this.account;
    }

    // --- NFT Logic ---

    async checkOwnership(address) {
        if (!this.publicClient || !address) return false;
        try {
            const balance = await this.publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: MINIMAL_ABI,
                functionName: 'balanceOf',
                args: [address]
            });
            return balance > 0n;
        } catch (error) {
            console.error("Ownership check failed:", error);
            return false;
        }
    }

    async mintNft() {
        if (!this.walletClient || !this.account) throw new Error("Wallet not connected");

        // Ensure network is correct before transaction
        await this.checkNetwork();

        const hash = await this.walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: MINIMAL_ABI,
            functionName: 'mint',
            account: this.account,
            chain: base
        });

        return hash;
    }
}

export const walletManager = new WalletManager();
