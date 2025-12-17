import './style.css'
import { Game } from './Game.js'
import { InputManager } from './InputManager.js'
import { Actuator } from './Actuator.js'
import { Leaderboard } from './Leaderboard.js'

import { WalletManager } from './WalletManager.js'

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  window.requestAnimationFrame(() => {
    window.walletManager = new WalletManager(); // Initialize WalletManager first
    const game = new Game(4, InputManager, Actuator);
    window.leaderboard = new Leaderboard(game);
  });
});
