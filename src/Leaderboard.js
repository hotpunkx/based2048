import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, serverTimestamp, where } from "firebase/firestore";
import { walletManager } from "./WalletManager";

export class Leaderboard {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.modal = document.getElementById("leaderboard-modal");
        this.usernameModal = document.getElementById("username-modal");
        this.btn = document.querySelector(".leaderboard-button");
        this.span = document.querySelector(".close-button");
        this.list = document.getElementById("leaderboard-list");

        this.usernameInput = document.getElementById("username-input");
        this.startGameBtn = document.getElementById("start-game-button");
        this.loginError = document.getElementById("login-error");

        this.connectCoinbaseBtn = document.getElementById("connect-coinbase");
        this.walletStatus = document.getElementById("wallet-status");
        this.walletButtons = document.getElementById("wallet-buttons");
        this.mintBtn = document.getElementById("mint-button");
        this.mintContainer = document.getElementById("mint-container");

        this.currentUser = null;
        this.hasNft = false;

        // Auto-detect offline mode if DB is missing
        this.mockDB = !db;
        if (this.mockDB) {
            console.warn("Database not configured. Offline mode.");
        }

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
        this.usernameInput.style.display = "none";
        this.startGameBtn.disabled = true;
        this.hasNft = false;
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
            // Proceed to load profile from DB
            await this.loginWithWallet(account);
        } else {
            this.loginError.textContent = "Access Pass Required.";
            this.mintContainer.style.display = "block";
            this.usernameInput.style.display = "block"; // Show inputs for registration flow
            this.mintBtn.textContent = "MINT FREE ACCESS NFT";
            this.mintBtn.disabled = false;
        }
    }

    bindEvents() {
        this.btn.onclick = () => this.open();
        this.span.onclick = () => this.close();
        window.onclick = (event) => {
            if (event.target === this.modal) this.close();
        };

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

    async loginWithWallet(address) {
        if (!address) return;
        const docId = address.toLowerCase();

        this.loginError.textContent = "Loading Profile...";

        // If offline mode, skip DB
        if (this.mockDB) {
            this.currentUser = {
                wallet: address,
                username: "Offline Player",
                bestScore: 0,
                chain: "base"
            };
            this.completeLogin();
            return;
        }

        try {
            const userRef = doc(db, "players", docId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                this.currentUser = userSnap.data();
                this.completeLogin();
            } else {
                // User has NFT but no profile (first time login after external mint?)
                // OR checking just after mint
                const username = this.usernameInput.value.trim() || "Base Player";
                const newUser = {
                    wallet: address,
                    username: username,
                    bestScore: 0,
                    chain: "base",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                await setDoc(userRef, newUser);
                this.currentUser = newUser;
                this.completeLogin();
            }

        } catch (error) {
            console.error("Login failed:", error);

            // Fallback to Guest Mode so user can still play
            this.loginError.textContent = "Profile mismatch. Playing as Verified Guest.";
            this.loginError.style.color = "var(--neon-yellow)";

            this.currentUser = {
                wallet: address,
                username: "Verified Guest",
                bestScore: 0,
                chain: "base",
                isGuest: true // Flag to prevent DB writes if needed
            };

            // Wait a moment so user sees the message
            setTimeout(() => this.completeLogin(), 1500);
        }
    }

    async handleMint() {
        if (!walletManager.getAccount()) {
            alert("Please connect wallet first.");
            return;
        }

        const username = this.usernameInput.value.trim();
        if (username.length < 3) {
            this.loginError.textContent = "Enter username (min 3 chars).";
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
                this.loginError.textContent = "Mint failed. Check console.";
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
                this.loginError.textContent = "Mint Verified! Logging in...";
                this.mintContainer.style.display = "none";
                this.usernameInput.style.display = "none";
                await this.loginWithWallet(account);
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
        if (this.currentUser && this.hasNft) {
            this.completeLogin();
        }
    }

    completeLogin() {
        this.mintContainer.style.display = "none";
        this.usernameInput.style.display = "none";
        this.usernameModal.style.display = "none";
        this.loginError.textContent = "";

        if (this.game) {
            this.game.setup(this.currentUser ? this.currentUser.bestScore : 0);
        }
    }

    async open() {
        this.modal.style.display = "block";
        await this.fetchScores();
    }

    close() {
        this.modal.style.display = "none";
    }

    async fetchScores() {
        this.list.textContent = "Loading...";
        if (this.mockDB) {
            this.list.textContent = "Offline Mode - No Leaderboard";
            return;
        }
        try {
            const q = query(collection(db, "players"), orderBy("bestScore", "desc"), limit(10));
            const querySnapshot = await getDocs(q);
            this.renderScores(querySnapshot.docs.map(d => d.data()));
        } catch (error) {
            console.error(error);
            this.list.textContent = "Error loading scores.";
        }
    }

    renderScores(dataList) {
        this.list.textContent = "";
        if (dataList.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No scores yet!";
            this.list.appendChild(li);
            return;
        }
        dataList.forEach((data) => {
            const li = document.createElement("li");
            let displayName = data.username || data.wallet || "Unknown";
            if (displayName.length > 15) displayName = displayName.slice(0, 6) + "...";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = displayName;
            const scoreSpan = document.createElement("span");
            scoreSpan.textContent = data.bestScore;

            if (this.currentUser && data.wallet && this.currentUser.wallet &&
                data.wallet.toLowerCase() === this.currentUser.wallet.toLowerCase()) {
                li.style.color = "var(--neon-green)";
            }

            li.appendChild(nameSpan);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(scoreSpan);
            this.list.appendChild(li);
        });
    }

    async submitScore(score) {
        if (!this.currentUser || !this.currentUser.wallet || this.mockDB) return;

        // Local Optimistic Check
        if (score <= this.currentUser.bestScore) return;

        this.currentUser.bestScore = score;
        const docId = this.currentUser.wallet.toLowerCase();

        try {
            const userRef = doc(db, "players", docId);

            // Transactional update to prevent race conditions
            // (Simpler: just check before write if we trust client state enough, 
            // but runTransaction is safer for global leaderboards)
            await updateDoc(userRef, {
                bestScore: score,
                updatedAt: serverTimestamp()
            });
            console.log("Score updated to Firebase:", score);
        } catch (error) {
            console.error("Update failed", error);
        }
    }
}
