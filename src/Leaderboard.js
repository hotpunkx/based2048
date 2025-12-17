import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

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

        this.startGameBtn.onclick = () => this.handleLogin();

        // Wallet Buttons
        this.connectMetaMaskBtn.onclick = () => this.handleWalletConnect("io.metamask");
        this.connectCoinbaseBtn.onclick = () => this.handleWalletConnect("com.coinbase.wallet");
        this.mintBtn.onclick = () => this.handleMint();

        // Allow Enter key to submit username
        this.usernameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.handleLogin();
        });
    }

    async handleLogin() {
        const username = this.usernameInput.value.trim().toLowerCase();
        if (!username) {
            this.loginError.textContent = "Please enter a username.";
            return;
        }

        if (username.length < 3) {
            this.loginError.textContent = "Username must be at least 3 characters.";
            return;
        }

        this.startGameBtn.disabled = true;
        this.startGameBtn.textContent = "CHECKING...";
        this.loginError.textContent = "";

        if (this.useMock) {
            this.mockLogin(username);
            return;
        }

        try {
            const userRef = doc(db, "players", username);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                this.currentUser = userSnap.data();
                this.currentUser = userSnap.data();
            } else {
                // Create new user
                const newUser = {
                    username: username,
                    bestScore: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                await setDoc(userRef, newUser);
                this.currentUser = newUser;
                this.currentUser = newUser;
            }

            this.completeLogin();

        } catch (error) {
            console.error("Login failed");
            this.loginError.textContent = "Error: " + error.message + " (Switching to offline mode)";
            // Fallback to mock if online fails
            this.useMock = true;
            this.mockLogin(username);
        }
    }

    async handleWalletConnect(walletId) {
        if (!window.walletManager) return;

        this.loginError.textContent = "Connecting...";

        try {
            const account = await window.walletManager.connect(walletId);

            // Connected, check NFT
            this.walletStatus.textContent = "Checking NFT Access...";
            const hasNft = await window.walletManager.checkOwnership();

            this.walletButtons.style.display = "none";
            this.walletStatus.textContent = "Connected: " + account.address.slice(0, 6) + "..." + account.address.slice(-4);

            if (hasNft) {
                this.usernameInput.style.display = "inline-block";
                this.usernameInput.value = account.address;
                this.startGameBtn.disabled = false;
                this.loginError.textContent = "";
                this.mintBtn.style.display = "none";
            } else {
                this.loginError.textContent = "NFT Required to Play!";
                this.mintBtn.style.display = "block";
                this.startGameBtn.disabled = true;
            }

        } catch (error) {
            this.loginError.textContent = "Connection failed: " + error.message;
        }
    }

    async handleMint() {
        this.mintBtn.disabled = true;
        this.mintBtn.textContent = "Minting...";
        try {
            await window.walletManager.mint();

            // Re-check
            this.mintBtn.textContent = "Checking Access...";
            const hasNft = await window.walletManager.checkOwnership();

            if (hasNft) {
                this.mintBtn.style.display = "none";
                this.usernameInput.style.display = "inline-block";
                this.usernameInput.value = window.walletManager.getAddress();
                this.startGameBtn.disabled = false;
                this.loginError.textContent = "Mint Successful! You can now play.";
            } else {
                this.loginError.textContent = "Minted but ownership check failed. Try refreshing.";
                this.mintBtn.disabled = false;
                this.mintBtn.textContent = "MINT ACCESS PASS";
            }
        } catch (error) {
            console.error(error);
            this.loginError.textContent = "Mint failed: " + error.message;
            this.mintBtn.disabled = false;
            this.mintBtn.textContent = "MINT ACCESS PASS";
        }
    }

    mockLogin(username) {
        // Simulate network delay
        setTimeout(() => {
            let storedUser = localStorage.getItem("mock_user_" + username);
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
            } else {
                this.currentUser = {
                    username: username,
                    bestScore: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                localStorage.setItem("mock_user_" + username, JSON.stringify(this.currentUser));
            }
            this.completeLogin();
        }, 500);
    }

    completeLogin() {
        this.usernameModal.style.display = "none";
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
            console.error("Fetch failed");
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
            // Highlight current user
            if (this.currentUser && data.username === this.currentUser.username) {
                li.style.borderColor = "var(--neon-green)";
                li.style.color = "var(--neon-green)";
                li.style.boxShadow = "inset 0 0 10px rgba(0, 255, 0, 0.2)";
            }

            const nameSpan = document.createElement("span");
            nameSpan.textContent = data.username;

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

        if (this.useMock) {
            localStorage.setItem("mock_user_" + this.currentUser.username, JSON.stringify(this.currentUser));
            return;
        }

        try {
            const userRef = doc(db, "players", this.currentUser.username);
            await updateDoc(userRef, {
                bestScore: score,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Update failed");
        }
    }

    sanitizeLog(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/[\n\r]/g, ' ').slice(0, 100);
    }
}
