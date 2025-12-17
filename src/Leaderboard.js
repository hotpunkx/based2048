import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, serverTimestamp, where } from "firebase/firestore";

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
        this.connectMetaMaskBtn = document.getElementById("connect-metamask");
        this.connectCoinbaseBtn = document.getElementById("connect-coinbase");
        this.walletStatus = document.getElementById("wallet-status");
        this.walletButtons = document.getElementById("wallet-buttons");
        this.mintBtn = document.getElementById("mint-button");

        this.currentUser = null;
        this.useMock = true; // Set to true for offline testing

        this.bindEvents();
    }

    bindEvents() {
        this.btn.onclick = () => this.open();
        this.span.onclick = () => this.close();
        window.onclick = (event) => {
            if (event.target === this.modal) this.close();
        };

        this.startGameBtn.onclick = () => this.onStartGameClick();

        // Wallet Buttons
        this.connectMetaMaskBtn.onclick = () => this.handleWalletConnect("io.metamask");
        this.connectCoinbaseBtn.onclick = () => this.handleWalletConnect("com.coinbase.wallet");
        this.mintBtn.onclick = () => this.handleMint();
    }

    async loginWithWallet(address, newUsername = null) {
        if (!address) return;

        const docId = address.toLowerCase();

        // Update UI
        this.loginError.textContent = "Loading Profile...";

        if (this.useMock) {
            // Mock login with wallet
            setTimeout(() => {
                let storedUser = localStorage.getItem("mock_user_" + docId);
                if (storedUser) {
                    this.currentUser = JSON.parse(storedUser);
                } else {
                    this.currentUser = {
                        wallet: address,
                        username: newUsername || ("Player " + address.slice(0, 4)),
                        bestScore: 0,
                        chain: "base",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    localStorage.setItem("mock_user_" + docId, JSON.stringify(this.currentUser));
                }
                this.completeLogin();
            }, 500);
            return;
        }

        try {
            const userRef = doc(db, "players", docId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                this.currentUser = userSnap.data();
            } else {
                // Create new user
                const newUser = {
                    wallet: address,
                    username: newUsername || "Unknown",
                    bestScore: 0,
                    chain: "base",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                await setDoc(userRef, newUser);
                this.currentUser = newUser;
            }

            // this.completeLogin(); // Do not auto-start. Wait for user to click START GAME.

        } catch (error) {
            console.error("Login failed:", error);
            this.loginError.textContent = "Error loading profile. Playing offline.";
            // Fallback to offline/mock
            this.useMock = true;
            this.currentUser = {
                wallet: address,
                username: newUsername || "Offline Player",
                bestScore: 0,
                chain: "base",
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // this.completeLogin();
        }
    }

    async handleWalletConnect(walletId) {
        if (!window.walletManager) return;

        this.loginError.textContent = "";
        this.walletStatus.textContent = "Connecting to Wallet...";
        this.walletStatus.style.color = "var(--neon-yellow)";

        try {
            const account = await window.walletManager.connect(walletId);

            // Connected, check NFT
            this.walletStatus.textContent = "Checking Access Pass...";
            const hasNft = await window.walletManager.checkOwnership();

            this.walletButtons.style.display = "none";
            this.walletStatus.textContent = "Connected: " + account.address.slice(0, 6) + "..." + account.address.slice(-4);
            this.walletStatus.style.color = "var(--neon-green)";

            if (hasNft) {
                this.mintBtn.style.display = "none";
                this.usernameInput.style.display = "none"; // Hide username input

                // Login with wallet
                this.loginError.textContent = "Loading Profile...";
                this.loginError.style.color = "var(--neon-cyan)";
                await this.loginWithWallet(account.address);

                this.startGameBtn.disabled = false;
                this.loginError.textContent = "READY TO PLAY";
                this.loginError.style.color = "var(--neon-green)";

            } else {
                this.loginError.textContent = "NFT Required to Play! Create a username to mint.";
                this.loginError.style.color = "var(--neon-pink)";
                this.mintBtn.style.display = "block";
                this.usernameInput.style.display = "inline-block"; // Show input for new user
                this.startGameBtn.disabled = true;
            }

        } catch (error) {
            console.error(error);
            this.walletStatus.textContent = "Connection Failed";
            this.walletStatus.style.color = "var(--neon-pink)";
            if (error.message && error.message.includes("rejected")) {
                this.loginError.textContent = "User rejected connection.";
            } else {
                this.loginError.textContent = "Error: " + (error.message || "Unknown error");
            }
            this.loginError.style.color = "var(--neon-pink)";
        }
    }

    async handleMint() {
        const username = this.usernameInput.value.trim();
        if (!username || username.length < 3) {
            this.loginError.textContent = "Username must be at least 3 characters.";
            return;
        }

        this.mintBtn.disabled = true;
        this.mintBtn.textContent = "Checking Username...";

        // 1. Check Uniqueness
        try {
            if (!this.useMock) {
                const q = query(collection(db, "players"), where("username", "==", username));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    this.loginError.textContent = "Username already taken.";
                    this.mintBtn.disabled = false;
                    this.mintBtn.textContent = "MINT FREE ACCESS NFT";
                    return;
                }
            }
        } catch (e) {
            console.error("Username check failed", e);
            // Proceed with caution or block? Let's block for safety unless mock.
            if (!this.useMock) {
                this.loginError.textContent = "Error checking username.";
                this.mintBtn.disabled = false;
                this.mintBtn.textContent = "MINT FREE ACCESS NFT";
                return;
            }
        }

        this.mintBtn.textContent = "Minting...";
        try {
            await window.walletManager.mint();

            // Re-check
            this.mintBtn.textContent = "Checking Access...";
            const hasNft = await window.walletManager.checkOwnership();

            if (hasNft) {
                this.mintBtn.style.display = "none";
                this.usernameInput.style.display = "none";
                this.loginError.textContent = "Mint Successful! Loading Profile...";
                this.loginError.style.color = "var(--neon-cyan)";
                await this.loginWithWallet(window.walletManager.getAddress(), username);
                this.startGameBtn.disabled = false;
                this.loginError.textContent = "Mint Success! READY TO PLAY";
                this.loginError.style.color = "var(--neon-green)";
            } else {
                this.loginError.textContent = "Minted but ownership check failed. Try refreshing.";
                this.mintBtn.disabled = false;
                this.mintBtn.textContent = "MINT FREE ACCESS NFT";
            }
        } catch (error) {
            console.error(error);
            this.loginError.textContent = "Mint failed: " + error.message;
            this.mintBtn.disabled = false;
            this.mintBtn.textContent = "MINT FREE ACCESS NFT";
        }
    }

    onStartGameClick() {
        if (this.currentUser) {
            this.completeLogin();
        }
    }

    // mockLogin() removed

    completeLogin() {
        this.usernameModal.style.display = "none";
        this.loginError.textContent = "";
        if (this.game) {
            this.game.setup(this.currentUser ? this.currentUser.bestScore : 0);
        } else {
            alert("Game instance is missing!");
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
        this.list.textContent = "";
        const li = document.createElement("li");
        li.textContent = "Loading...";
        this.list.appendChild(li);

        if (this.useMock) {
            this.mockFetchScores();
            return;
        }

        try {
            const q = query(collection(db, "players"), orderBy("bestScore", "desc"), limit(10));
            const querySnapshot = await getDocs(q);
            this.renderScores(querySnapshot.docs.map(d => d.data()));
        } catch (error) {
            console.error("Fetch failed", error);
            this.list.textContent = "";
            const li = document.createElement("li");
            li.textContent = "Error loading scores.";
            this.list.appendChild(li);
        }
    }

    mockFetchScores() {
        setTimeout(() => {
            // Get all mock users from local storage
            const scores = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith("mock_user_")) {
                    scores.push(JSON.parse(localStorage.getItem(key)));
                }
            }
            // Sort by best score
            scores.sort((a, b) => b.bestScore - a.bestScore);
            this.renderScores(scores.slice(0, 10));
        }, 500);
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

            // Format: Username (or truncated wallet if legacy/missing)
            let displayName = data.username ? data.username : data.wallet;

            // Fallback truncation if it looks like a wallet address and is long
            if (!data.username && displayName && displayName.length > 15) {
                displayName = displayName.slice(0, 6) + "..." + displayName.slice(-4);
            }
            if (!displayName) displayName = "Unknown";

            // Highlight current user
            if (this.currentUser && data.wallet && this.currentUser.wallet &&
                data.wallet.toLowerCase() === this.currentUser.wallet.toLowerCase()) {
                li.style.borderColor = "var(--neon-green)";
                li.style.color = "var(--neon-green)";
                li.style.boxShadow = "inset 0 0 10px rgba(0, 255, 0, 0.2)";
                displayName += " (You)";
            }

            const nameSpan = document.createElement("span");
            nameSpan.textContent = displayName;

            const scoreSpan = document.createElement("span");
            scoreSpan.textContent = data.bestScore;

            li.appendChild(nameSpan);
            li.appendChild(document.createTextNode(" "));
            li.appendChild(scoreSpan);

            this.list.appendChild(li);
        });
    }

    async submitScore(score) {
        if (!this.currentUser || score <= this.currentUser.bestScore) return;

        this.currentUser.bestScore = score;
        const docId = this.currentUser.wallet.toLowerCase();

        if (this.useMock) {
            localStorage.setItem("mock_user_" + docId, JSON.stringify(this.currentUser));
            return;
        }

        try {
            const userRef = doc(db, "players", docId);
            await updateDoc(userRef, {
                bestScore: score,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Update failed", error);
        }
    }

    sanitizeLog(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/[\n\r]/g, ' ').slice(0, 100);
    }
}

