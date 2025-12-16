import { secureRandom } from './cryptoUtils.js';

export class Grid {
    constructor(size) {
        this.size = size;
        this.cells = this.empty();
    }
    // ...
    randomEmptyCell() {
        const cells = this.availableCells();
        if (cells.length) {
            return cells[Math.floor(secureRandom() * cells.length)];
        }
    }

    empty() {
        const cells = [];
        for (let x = 0; x < this.size; x++) {
            const row = [];
            for (let y = 0; y < this.size; y++) {
                row.push(null);
            }
            cells.push(row);
        }
        return cells;
    }



    availableCells() {
        const cells = [];
        this.eachCell((x, y, tile) => {
            if (!tile) {
                cells.push({ x, y });
            }
        });
        return cells;
    }

    eachCell(callback) {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                callback(x, y, this.cells[x][y]);
            }
        }
    }

    cellsAvailable() {
        return !!this.availableCells().length;
    }

    cellAvailable(cell) {
        return !this.cellOccupied(cell);
    }

    cellOccupied(cell) {
        return !!this.cellContent(cell);
    }

    cellContent(cell) {
        if (this.withinBounds(cell)) {
            return this.cells[cell.x][cell.y];
        } else {
            return null;
        }
    }

    insertTile(tile) {
        if (!this.withinBounds(tile)) return;
        this.cells[tile.x][tile.y] = tile;
    }

    removeTile(tile) {
        if (!this.withinBounds(tile)) return;
        this.cells[tile.x][tile.y] = null;
    }

    withinBounds(position) {
        return position.x >= 0 && position.x < this.size &&
            position.y >= 0 && position.y < this.size;
    }
}
