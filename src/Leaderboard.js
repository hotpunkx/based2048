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

        this.connectCoinbaseBtn = document.getElementById("connect-coinbase");
        this.walletStatus = document.getElementById("wallet-status");
        this.walletButtons = document.getElementById("wallet-buttons");
        this.mintBtn = document.getElementById("mint-button");

        this.currentUser = null;
        this.useMock = false; // Set to true for offline testing

        this.bindEvents();
        this.init();
    }

    async init() {
        // Attempt auto-connect for Base App
        await this.handleAutoConnect();
    }

    bindEvents() {
        this.btn.onclick = () => this.open();
        this.span.onclick = () => this.close();
        window.onclick = (event) => {
            if (event.target === this.modal) this.close();
        };

        this.startGameBtn.onclick = () => this.onStartGameClick();

        // Enable start button when username is typed
        this.usernameInput.addEventListener('input', (e) => {
            this.startGameBtn.disabled = e.target.value.length < 3;
        });

        // Wallet Buttons
        // We now treat "Mint" as the primary "Connect & Mint" action for new users
        if (this.connectCoinbaseBtn) {
            this.connectCoinbaseBtn.style.display = "none"; // Hide explicit connect button, use Mint instead
        }
        // Force Mint button to be visible initially if not connected (handled in init/logic) generally
        // But for safety, let's just use the Mint button as the main logical entry.
        this.mintBtn.style.display = "block";

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

    async handleAutoConnect() {
        if (!window.walletManager) return;

        try {
            const account = await window.walletManager.autoConnect();
            if (account) {
                this.walletStatus.textContent = "Auto-Connected: " + account.address.slice(0, 6);
                this.walletStatus.style.color = "var(--neon-green)";
                this.walletButtons.style.display = "none";

                // Check NFT
                this.walletStatus.textContent = "Checking Access Pass...";
                const hasNft = await window.walletManager.checkOwnership();

                if (hasNft) {
                    this.loginError.textContent = "READY TO PLAY";
                    this.loginError.style.color = "var(--neon-green)";
                    this.usernameInput.style.display = "none";
                    this.mintBtn.style.display = "none";
                    await this.loginWithWallet(account.address);
                    this.startGameBtn.disabled = false;
                } else {
                    // No NFT, need to mint
                    this.loginError.textContent = "Wallet Connected! Enter username to Mint NFT.";
                    this.loginError.style.color = "var(--neon-yellow)";
                    this.mintBtn.style.display = "block";
                    this.usernameInput.style.display = "block"; // Ensure visible
                    this.startGameBtn.disabled = true; // Disable until minted
                }

            } else {
                // Auto connect returned null (not capable)
                // Ensure Mint button is visible for manual connection
                this.mintBtn.style.display = "block";
            }
        } catch (e) {
            console.log("Auto connect failed", e);
            this.mintBtn.style.display = "block";
        }
    }

    async handleWalletConnect(walletId) {
        // Mock Mode Bypass
        if (this.useMock) {
            this.walletButtons.style.display = "none";
            this.walletStatus.textContent = "Mock Wallet Connected";
            this.walletStatus.style.color = "var(--neon-green)";

            const mockAddress = "0x" + Math.random().toString(16).substr(2, 40);

            // Check if we have "mock NFT"
            const hasNft = localStorage.getItem("mock_nft_" + mockAddress) === "true";

            if (hasNft) {
                this.mintBtn.style.display = "none";
                this.usernameInput.style.display = "none";
                this.loginError.textContent = "Loading Mock Profile...";
                this.loginError.style.color = "var(--neon-cyan)";
                await this.loginWithWallet(mockAddress);
                this.startGameBtn.disabled = false;
                this.loginError.textContent = "READY TO PLAY (MOCK)";
                this.loginError.style.color = "var(--neon-green)";
                return true; // Return success
            } else {
                this.loginError.textContent = "Mock NFT Required! Create a username to mint.";
                this.loginError.style.color = "var(--neon-pink)";
                this.mintBtn.style.display = "block";
                this.usernameInput.style.display = "inline-block";
                this.startGameBtn.disabled = true;
                // Store address for minting step
                this.tempMockAddress = mockAddress;
                return true; // Connected, proceed to mint
            }
        }

        if (!window.walletManager) return false;

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
                return true; // Already has NFT

            } else {
                this.loginError.textContent = "Wallet Connected! Enter username to Mint NFT.";
                this.loginError.style.color = "var(--neon-yellow)";
                this.mintBtn.style.display = "block";
                this.usernameInput.style.display = "block";
                this.startGameBtn.disabled = true; // Wait for mint
                return true; // Connected, needs mint
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
            return false;
        }
    }

    async handleMint() {
        // If not connected, connect first
        if (!window.walletManager || (!window.walletManager.isConnected() && !this.useMock)) {
            console.log("Not connected, connecting first...");
            const connected = await this.handleWalletConnect("com.coinbase.wallet");
            if (!connected) return; // Stop if connection failed

            // After connection, check if we still need to mint (might have ownership)
            // handleWalletConnect updates UI and state. 
            // If user already had NFT, mintBtn is hidden. We should check visibility/state.
            if (this.mintBtn.style.display === "none") return;
        }

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
                if (!db) throw new Error("Database not connected. Check .env");
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
            if (!this.useMock) {
                // Show exact error
                this.loginError.textContent = "Check Failed: " + (e.message || "Unknown");
                this.mintBtn.disabled = false;
                this.mintBtn.textContent = "MINT FREE ACCESS NFT";
                return;
            }
        }

        this.mintBtn.textContent = "Minting...";
        try {
            let hasNft = false;

            if (this.useMock) {
                // Simulate minting delay
                await new Promise(r => setTimeout(r, 1000));
                if (this.tempMockAddress) {
                    localStorage.setItem("mock_nft_" + this.tempMockAddress, "true");
                    // Also use tempMockAddress for login
                    window.mockWalletAddress = this.tempMockAddress;
                }
                hasNft = true;
            } else {
                await window.walletManager.mint();

                // Re-check
                this.mintBtn.textContent = "Checking Access...";
                hasNft = await window.walletManager.checkOwnership();
            }

            if (hasNft) {
                this.mintBtn.style.display = "none";
                this.usernameInput.style.display = "none";
                this.loginError.textContent = "Mint Successful! Loading Profile...";
                this.loginError.style.color = "var(--neon-cyan)";
                await this.loginWithWallet(this.useMock ? (window.mockWalletAddress || "0xMock") : window.walletManager.getAddress(), username);
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
        if (!this.currentUser) {
            // Guest Mode
            const username = this.usernameInput.value.trim() || "Guest";
            const guestId = "guest_" + Date.now().toString().slice(-6);
            this.currentUser = {
                wallet: guestId,
                username: username,
                bestScore: 0,
                chain: "guest",
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save guest session locally
            localStorage.setItem("last_guest_session", JSON.stringify(this.currentUser));
        }
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

        // Safety check
        if (!this.currentUser.wallet) return;

        const docId = this.currentUser.wallet.toLowerCase();

        // Guest / Mock save
        if (this.useMock || this.currentUser.chain === "guest") {
            if (this.currentUser.chain === "guest") {
                localStorage.setItem("last_guest_session", JSON.stringify(this.currentUser));
            } else {
                localStorage.setItem("mock_user_" + docId, JSON.stringify(this.currentUser));
            }
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

