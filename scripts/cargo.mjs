import path from "node:path";
import { spawn } from "node:child_process";
import { root, env } from "./environment.mjs";

const [command = "test", ...args] = process.argv.slice(2);
const child = spawn(
  "cargo",
  [
    command,
    "--manifest-path",
    path.join(root, "src-tauri", "Cargo.toml"),
    ...args,
  ],
  { cwd: root, env, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
