export class Actuator {
    constructor() {
        this.tileContainer = document.querySelector(".tile-container");
        this.scoreContainer = document.querySelector(".score-container");
        this.bestContainer = document.querySelector(".best-container");
        this.messageContainer = document.querySelector(".game-message");

        this.score = 0;
    }

    actuate(grid, metadata) {
        window.requestAnimationFrame(() => {
            this.clearContainer(this.tileContainer);

            grid.cells.forEach(column => {
                column.forEach(cell => {
                    if (cell) {
                        this.addTile(cell);
                    }
                });
            });

            this.updateScore(metadata.score);
            this.updateBestScore(metadata.bestScore);

            if (metadata.terminated) {
                if (metadata.over) {
                    this.message(false); // You lose
                } else if (metadata.won) {
                    this.message(true); // You win
                }
            }
        });
    }

    addTile(tile) {
        if (!tile || typeof tile.x !== 'number' || typeof tile.y !== 'number' || typeof tile.value !== 'number') {
            return;
        }
        const wrapper = document.createElement("div");
        const inner = document.createElement("div");
        const position = tile.previousPosition || { x: tile.x, y: tile.y };
        const positionClass = this.positionClass(position);

        // We can't use classList because it somehow glitches when replacing classes
        const classes = ["tile", "tile-" + tile.value, positionClass];

        if (tile.value > 2048) classes.push("tile-super");

        this.applyClasses(wrapper, classes);

        inner.classList.add("tile-inner");
        inner.textContent = tile.value;

        if (tile.previousPosition) {
            // Make sure that the tile gets rendered in the previous position first
            window.requestAnimationFrame(() => {
                classes.splice(2, 1, this.positionClass({ x: tile.x, y: tile.y }));
                this.applyClasses(wrapper, classes); // Update the position
            });
        } else if (tile.mergedFrom) {
            classes.push("tile-merged");
            this.applyClasses(wrapper, classes);
            // Render the tiles that merged
            tile.mergedFrom.forEach(merged => {
                this.addTile(merged);
            });
        } else {
            classes.push("tile-new");
            this.applyClasses(wrapper, classes);
        }

        wrapper.appendChild(inner);

        // Put the tile on the board
        this.tileContainer.appendChild(wrapper);
    }

    applyClasses(element, classes) {
        element.setAttribute("class", classes.join(" "));
    }

    normalizePosition(position) {
        return { x: position.x + 1, y: position.y + 1 };
    }

    positionClass(position) {
        position = this.normalizePosition(position);
        return "tile-position-" + position.x + "-" + position.y;
    }

    updateScore(score) {
        this.clearContainer(this.scoreContainer);

        const difference = score - this.score;
        this.score = score;

        this.scoreContainer.textContent = this.score;

        if (difference > 0) {
            const addition = document.createElement("div");
            addition.classList.add("score-addition");
            addition.textContent = "+" + difference;

            this.scoreContainer.appendChild(addition);
        }

        this.updateLevel(score);
    }

    updateBestScore(bestScore) {
        this.bestContainer.textContent = bestScore;
    }

    message(won) {
        const type = won ? "game-won" : "game-over";
        const message = won ? "You Win!" : "Game Over";

        this.messageContainer.classList.add(type);
        this.messageContainer.getElementsByTagName("p")[0].textContent = message;
    }

    continueGame() {
        this.messageContainer.classList.remove("game-won");
        this.messageContainer.classList.remove("game-over");
    }

    clearContainer(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    updateLevel(score) {
        const POINTS_PER_LEVEL = 2000;
        let level = Math.floor(score / POINTS_PER_LEVEL) + 1;
        let progress = ((score % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100;

        if (level >= 50) {
            level = 50;
            progress = 100;
        }

        const levelText = document.querySelector(".level-text");
        const levelProgressText = document.querySelector(".level-progress-text");
        const levelFill = document.querySelector(".level-fill");

        if (levelText) levelText.textContent = "LEVEL " + level;
        if (levelFill) levelFill.style.width = progress + "%";

        if (levelProgressText) {
            const nextLevelScore = level * POINTS_PER_LEVEL;
            const currentLevelScore = score % POINTS_PER_LEVEL;
            if (level >= 50) {
                levelProgressText.textContent = "MAX LEVEL";
            } else {
                levelProgressText.textContent = Math.floor(currentLevelScore) + " / " + POINTS_PER_LEVEL;
            }
        }
    }
}
