import Phaser from "phaser";
import { RunnerScene, RunnerCallbacks } from "./RunnerScene";

export function createRunnerGame(parent: HTMLElement, callbacks: RunnerCallbacks): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 540,
    backgroundColor: "#070b16",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 900 },
        debug: false,
      },
    },
    scene: RunnerScene,
  });

  game.scene.start("RunnerScene", { callbacks });
  return game;
}
