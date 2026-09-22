import { execSync } from "node:child_process";

let cached: boolean | undefined;

export function isDockerAvailable(): boolean {
  if (cached !== undefined) return cached;
  try {
    execSync("docker info", { stdio: "ignore" });
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
