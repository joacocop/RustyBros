import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env };
// Windows environment keys are case-insensitive; Node must receive only one PATH.
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path");
const systemPath = pathKey ? env[pathKey] : "";
if (pathKey) delete env[pathKey];
env.PATH = systemPath ?? "";
const tools = path.join(root, ".tools");
const cargo = path.join(tools, "cargo");
if (existsSync(path.join(cargo, "bin", "cargo.exe"))) {
  env.CARGO_HOME = cargo;
  env.RUSTUP_HOME = path.join(tools, "rustup");
  env.PATH = `${path.join(cargo, "bin")}${path.delimiter}${env.PATH ?? ""}`;
  const compiler = readdirSync(tools).find(
    (name) =>
      name.startsWith("llvm-mingw-") &&
      existsSync(path.join(tools, name, "bin")),
  );
  if (compiler) {
    const bin = path.join(tools, compiler, "bin");
    env.PATH = `${bin}${path.delimiter}${env.PATH}`;
    env.CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = path.join(
      bin,
      "x86_64-w64-mingw32-clang.exe",
    );
    env.CC_x86_64_pc_windows_gnu = path.join(
      bin,
      "x86_64-w64-mingw32-clang.exe",
    );
    env.CXX_x86_64_pc_windows_gnu = path.join(
      bin,
      "x86_64-w64-mingw32-clang++.exe",
    );
    env.RUSTFLAGS = `${env.RUSTFLAGS ?? ""} -C link-self-contained=yes`.trim();
  }
}

export { root, env };
