import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cybergems-github-star-'));
const executable = path.join(scratch, process.platform === 'win32' ? 'github-star-test.exe' : 'github-star-test');
try {
  execFileSync('rustc', ['--edition=2021', '--test', 'src-tauri/src/github_star_cli.rs', '-o', executable], { stdio: 'inherit' });
  execFileSync(executable, [], { stdio: 'inherit' });
} finally {
  if (path.dirname(path.resolve(scratch)) !== path.resolve(os.tmpdir())) throw new Error('Unexpected test directory');
  fs.rmSync(scratch, { recursive: true, force: true });
}
