import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

const compiler = spawnSync('rustup', ['which', 'rustc'], { encoding: 'utf8' }).stdout?.trim();
const result = spawnSync('rustup', ['run', 'stable', 'cargo', 'build', '--manifest-path', 'core/Cargo.toml', '--target', 'wasm32-unknown-unknown', '--release'], { stdio: 'inherit', env: { ...process.env, ...(compiler ? { RUSTC: compiler } : {}) } });
if (result.status !== 0) {
  console.error('Rust build failed. Install the target with: rustup target add wasm32-unknown-unknown');
  process.exit(result.status || 1);
}
mkdirSync('public', { recursive: true });
copyFileSync('core/target/wasm32-unknown-unknown/release/pipit_core.wasm', 'public/core.wasm');
