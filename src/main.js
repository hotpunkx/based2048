import './style.css'
import { Game } from './Game.js'
import { InputManager } from './InputManager.js'
import { Actuator } from './Actuator.js'
import { Leaderboard } from './Leaderboard.js'

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  window.requestAnimationFrame(() => {
    try {
      console.log("Initializing Game...");
      const game = new Game(4, InputManager, Actuator);
      window.leaderboard = new Leaderboard(game);
      console.log("Initialization Complete");
    } catch (e) {
      console.error("Init Error:", e);
      alert("Game Init Error: " + e.message + "\n" + e.stack);
    }
  });

  window.addEventListener("click", () => {
    window.focus();
  });

  // Check if running in an iframe
  if (window.self !== window.top) {
    document.body.classList.add('is-embedded');
  }
});
