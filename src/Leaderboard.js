import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit, addDoc } from "firebase/firestore";

export class Leaderboard {
    constructor() {
        this.modal = document.getElementById("leaderboard-modal");
        this.btn = document.querySelector(".leaderboard-button");
        this.span = document.querySelector(".close-button");
        this.list = document.getElementById("leaderboard-list");

        this.bindEvents();
    }

    bindEvents() {
        this.btn.onclick = () => {
            this.open();
        };

        this.span.onclick = () => {
            this.close();
        };

        window.onclick = (event) => {
            if (event.target == this.modal) {
                this.close();
            }
        };
    }

    async open() {
        this.modal.style.display = "block";
        await this.fetchScores();
    }

    close() {
        this.modal.style.display = "none";
    }

    async fetchScores() {
        this.list.innerHTML = "<li>Loading...</li>";

        try {
            const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
            const querySnapshot = await getDocs(q);

            this.list.innerHTML = "";

            if (querySnapshot.empty) {
                this.list.innerHTML = "<li>No scores yet!</li>";
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const li = document.createElement("li");
                li.innerHTML = `<span>${data.name || "Anonymous"}</span> <span>${data.score}</span>`;
                this.list.appendChild(li);
            });
        } catch (error) {
            console.error("Error fetching scores:", error);
            this.list.innerHTML = "<li>Error loading scores</li>";
        }
    }

    async submitScore(score) {
        if (score <= 0) return;

        const name = prompt("New High Score! Enter your name:", "Player");
        if (!name) return;

        try {
            await addDoc(collection(db, "scores"), {
                name: name,
                score: score,
                date: new Date()
            });
            alert("Score submitted!");
        } catch (error) {
            console.error("Error adding score: ", error);
            alert("Failed to submit score.");
        }
    }
}
