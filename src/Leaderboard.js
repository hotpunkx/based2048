import { walletManager } from "./WalletManager";

export class Leaderboard {
    constructor(gameInstance) {
        this.game = gameInstance;
        // Re-purposing existing DOM elements for Gating UI, ignoring Leaderboard specific ones
        this.usernameModal = document.getElementById("username-modal"); // renaming to "login-modal" effectively
        this.startGameBtn = document.getElementById("start-game-button");
        this.loginError = document.getElementById("login-error");

        this.connectCoinbaseBtn = document.getElementById("connect-coinbase");
        this.walletStatus = document.getElementById("wallet-status");
        this.walletButtons = document.getElementById("wallet-buttons");
        this.mintBtn = document.getElementById("mint-button");
        this.mintContainer = document.getElementById("mint-container");

        this.currentUser = null;
        this.hasNft = false;

        this.bindEvents();
        this.init();
    }

    async init() {
        // Init Wallet Manager (Auto-Connect)
        walletManager.onAccountChange = (account) => this.handleAccountChange(account);

        try {
            this.walletStatus.textContent = "Checking Wallet...";
            const account = await walletManager.init();
            if (account) {
                this.handleAccountChange(account);
            } else {
                this.showConnectUI();
            }
        } catch (e) {
            console.error("Auto-connect init error:", e);
            this.showConnectUI();
        }
    }

    showConnectUI() {
        this.walletButtons.style.display = "flex";
        this.walletStatus.textContent = "Not Connected";
        this.walletStatus.style.color = "#fff";
        this.mintContainer.style.display = "none";
        // this.usernameInput.style.display = "none"; // Removed
        this.startGameBtn.disabled = true;
        this.hasNft = false;

        // Ensure modal is visible if we are waiting for login
        this.usernameModal.style.display = "block";
    }

    async handleAccountChange(account) {
        if (!account) {
            this.showConnectUI();
            this.currentUser = null;
            return;
        }

        this.walletButtons.style.display = "none";
        this.walletStatus.textContent = "Connected: " + account.slice(0, 6) + "..." + account.slice(-4);
        this.walletStatus.style.color = "var(--neon-green)";

        // Check NFT Ownership immediately
        await this.checkAccess(account);
    }

    async checkAccess(account) {
        this.loginError.textContent = "Checking Access Pass...";
        this.loginError.style.color = "var(--neon-yellow)";
        this.startGameBtn.disabled = true;

        const owned = await walletManager.checkOwnership(account);
        this.hasNft = owned;

        if (owned) {
            this.loginError.textContent = "Access Granted.";
            this.prepareGameStart();
        } else {
            this.loginError.textContent = "Access Pass Required.";
            this.mintContainer.style.display = "block";
            this.mintBtn.textContent = "MINT FREE ACCESS NFT";
            this.mintBtn.disabled = false;
        }
    }

    bindEvents() {
        this.startGameBtn.onclick = () => this.onStartGameClick();

        // Wallet Buttons
        if (this.connectCoinbaseBtn) {
            this.connectCoinbaseBtn.onclick = async () => {
                this.walletStatus.textContent = "Connecting...";
                try {
                    await walletManager.connect();
                    // onAccountChange will trigger
                } catch (e) {
                    this.walletStatus.textContent = "Connection Failed";
                    this.walletStatus.style.color = "red";
                }
            };
        }

        this.mintBtn.onclick = () => this.handleMint();
    }

    prepareGameStart() {
        // Just show the play button
        this.startGameBtn.disabled = false;
        // Optionally auto-start or wait for user to click PLAY
        // Current UX waits for PLAY click
    }

    async handleMint() {
        if (!walletManager.getAccount()) {
            alert("Please connect wallet first.");
            return;
        }

        try {
            this.mintBtn.textContent = "Confirming in Wallet...";
            this.mintBtn.disabled = true;
            this.loginError.textContent = "Please confirm the transaction...";

            const hash = await walletManager.mintNft();

            // Show TX Hash
            const shortHash = hash.slice(0, 10) + "..." + hash.slice(-8);
            this.loginError.innerHTML = `Minting... Tx: <a href="https://basescan.org/tx/${hash}" target="_blank" style="color:var(--neon-cyan)">${shortHash}</a>`;
            this.mintBtn.textContent = "Minting (Wait...)";

            // Poll for confirmation
            this.pollForOwnership();

        } catch (error) {
            console.error("Mint failed:", error);

            // Handle User Rejection
            if (error.cause?.code === 4001 || error.message?.includes("rejected")) {
                this.loginError.textContent = "Transaction cancelled by user.";
            } else {
                this.loginError.textContent = "Mint failed: " + (error.message || "Unknown error");
            }

            this.mintBtn.textContent = "TRY AGAIN";
            this.mintBtn.disabled = false;
        }
    }

    async pollForOwnership() {
        const account = walletManager.getAccount();
        let attempts = 0;
        const maxAttempts = 20; // 40 seconds approx

        const check = async () => {
            attempts++;
            this.loginError.textContent = `Minting... Verifying (${attempts})...`;
            const owned = await walletManager.checkOwnership(account);
            if (owned) {
                this.loginError.textContent = "Mint Verified! Ready to Play.";
                this.mintContainer.style.display = "none";
                this.prepareGameStart();
            } else {
                if (attempts < maxAttempts) {
                    setTimeout(check, 2000);
                } else {
                    this.loginError.textContent = "Mint transaction confirmed but balance not updated yet. Refresh page.";
                    this.mintBtn.textContent = "Refresh Page";
                    this.mintBtn.disabled = false;
                    this.mintBtn.onclick = () => window.location.reload();
                }
            }
        };
        check();
    }

    onStartGameClick() {
        if (this.hasNft) {
            this.completeLogin();
        }
    }

    completeLogin() {
        this.mintContainer.style.display = "none";
        this.usernameModal.style.display = "none";
        this.loginError.textContent = "";

        if (this.game) {
            // Standard 2048 start (0 score)
            this.game.setup(0);
        }
    }

    // No-ops for old calls if any remain
    fetchScores() { }
    submitScore() { }
}
