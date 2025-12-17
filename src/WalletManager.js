import { createWallet } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import { client } from "./thirdweb";
import { getContract, sendTransaction } from "thirdweb";
import { balanceOf, claimTo } from "thirdweb/extensions/erc721";

export class WalletManager {
    constructor() {
        this.activeWallet = null;
        this.account = null;
        this.chain = base;
        this.listeners = [];
        this.nftContractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS;
    }

    onAddressChanged(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.account ? this.account.address : null));
    }

    async connect(walletId) {
        try {
            const wallet = createWallet(walletId);

            // Connect to the wallet
            // For injected wallets like MetaMask, this triggers the popup
            this.account = await wallet.connect({
                client: client,
                chain: this.chain, // Request connection to Base directly
            });

            this.activeWallet = wallet;

            // Check chain and switch if necessary (though connect({chain}) usually handles it)
            const chainId = wallet.getChain()?.id;
            if (chainId && chainId !== this.chain.id) {
                await this.switchNetwork();
            }

            console.log("Connected:", this.account.address);
            this.notifyListeners();
            return this.account;
        } catch (error) {
            console.error("Connection failed:", error);
            throw error;
        }
    }

    async autoConnect() {
        try {
            // Guard: Only auto-connect if an injected provider is present (e.g. Base App, explicit extension).
            if (typeof window !== "undefined" && !window.ethereum && !window.coinbaseWalletExtension) {
                console.log("No injected wallet found, skipping auto-connect to prevent QR modal.");
                return null;
            }

            // Priority: Coinbase Wallet (Smart Wallet) for Base App
            const wallet = createWallet("com.coinbase.wallet");

            this.account = await wallet.connect({
                client: client,
                chain: this.chain,
            });

            this.activeWallet = wallet;

            // Check chain
            const chainId = wallet.getChain()?.id;
            if (chainId && chainId !== this.chain.id) {
                await this.switchNetwork();
            }

            console.log("Auto-Connected:", this.account.address);
            this.notifyListeners();
            return this.account;
        } catch (error) {
            // Auto-connect failed
            console.log("Auto-connect skipped or failed:", error);
            return null;
        }
    }

    async getContract() {
        if (!this.nftContractAddress) {
            console.error("NFT Contract Address not set!");
            return null;
        }
        return getContract({
            client,
            chain: this.chain,
            address: this.nftContractAddress,
        });
    }

    async checkOwnership() {
        if (!this.account) return false;

        try {
            const contract = await this.getContract();
            if (!contract) {
                console.error("No contract address found. Gating is strict: Access Denied.");
                return false;
            }

            const balance = await balanceOf({
                contract,
                owner: this.account.address,
            });

            return balance > 0n;
        } catch (error) {
            console.error("Failed to check ownership:", error);
            return false;
        }
    }

    async mint() {
        if (!this.account) return;
        try {
            const contract = await this.getContract();
            if (!contract) throw new Error("Contract not configured");

            const transaction = claimTo({
                contract,
                to: this.account.address,
                quantity: 1n,
            });

            // Send transaction
            const { transactionHash } = await sendTransaction({
                transaction,
                account: this.account,
            });

            console.log("Minted:", transactionHash);
            return transactionHash;
        } catch (error) {
            console.error("Mint failed:", error);
            throw error;
        }
    }

    async switchNetwork() {
        if (!this.activeWallet) return;
        try {
            await this.activeWallet.switchChain(this.chain);
        } catch (error) {
            console.error("Failed to switch network:", error);
            throw error;
        }
    }

    getAddress() {
        return this.account ? this.account.address : null;
    }

    isConnected() {
        return !!this.account;
    }
}
