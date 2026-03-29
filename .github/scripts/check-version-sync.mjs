#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseCargoVersion(contents) {
  const match = contents.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("Could not find a package version in src-tauri/Cargo.toml.");
  }

  return match[1];
}

function parseReleaseTag(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--tag") {
      return args[index + 1] ?? "";
    }

    if (arg.startsWith("--tag=")) {
      return arg.slice("--tag=".length);
    }
  }

  return process.env.RELEASE_TAG ?? "";
}

const packageJson = readJson("package.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const cargoVersion = parseCargoVersion(readFileSync("src-tauri/Cargo.toml", "utf8"));
const releaseTag = parseReleaseTag(process.argv.slice(2));

const versions = [
  ["package.json", packageJson.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", cargoVersion],
];

const uniqueVersions = new Set(versions.map(([, version]) => version));

if (uniqueVersions.size !== 1) {
  console.error("Version files are out of sync:");
  for (const [file, version] of versions) {
    console.error(`- ${file}: ${version}`);
  }
  process.exit(1);
}

const [[, appVersion]] = versions;

if (releaseTag) {
  const normalizedTag = releaseTag.startsWith("v") ? releaseTag.slice(1) : releaseTag;

  if (normalizedTag !== appVersion) {
    console.error(
      `Release tag ${releaseTag} does not match the application version ${appVersion}.`
    );
    process.exit(1);
  }
}

const suffix = releaseTag ? ` and release tag ${releaseTag}` : "";
console.log(`Version sync OK for app version ${appVersion}${suffix}.`);
