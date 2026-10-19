import { spawnSync } from 'node:child_process';

const compiler = spawnSync('rustup', ['which', 'rustc'], { encoding: 'utf8' }).stdout?.trim();
const result = spawnSync('rustup', ['run', 'stable', 'cargo', 'test', '--manifest-path', 'core/Cargo.toml'], { stdio: 'inherit', env: { ...process.env, ...(compiler ? { RUSTC: compiler } : {}) } });
process.exit(result.status ?? 1);
