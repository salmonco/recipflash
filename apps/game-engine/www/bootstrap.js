import init, { greet } from './pkg/game_engine.js';

async function run() {
  await init();
  greet();
  console.log('Wasm module initialized.');
}

run();
