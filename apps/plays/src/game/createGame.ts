import Phaser from "phaser";
import { TrapScene, TrapSceneCallbacks } from "./TrapScene";

export function createGame(
  parent: HTMLElement,
  callbacks: TrapSceneCallbacks,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 540,
    backgroundColor: "#0f172a",
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
    scene: TrapScene,
  });

  game.scene.start("TrapScene", {
    callbacks,
    levelIndex: 0,
    deaths: 0,
    startTime: 0,
  });
  return game;
}
