import { spawn } from "node:child_process";
import type { Project } from "../types/domain.js";
import { parseTestSpritePayload, type TestSpriteCommandResult } from "./testspriteMapper.js";

export interface TestSpriteConfig {
  apiKey: string;
  projectId: string;
  testId?: string;
  cliBin: string;
  timeoutSeconds: number;
}

export function readTestSpriteConfig(env: NodeJS.ProcessEnv = process.env): TestSpriteConfig {
  return {
    apiKey: env.TESTSPRITE_API_KEY?.trim() ?? "",
    projectId: env.TESTSPRITE_PROJECT_ID?.trim() ?? "",
    testId: env.TESTSPRITE_TEST_ID?.trim() || undefined,
    cliBin: env.TESTSPRITE_CLI_BIN?.trim() || "testsprite",
    timeoutSeconds: Number(env.TESTSPRITE_TIMEOUT_SECONDS ?? 900)
  };
}

export async function runTestSpriteCli(project: Project, config = readTestSpriteConfig()): Promise<TestSpriteCommandResult> {
  const args = buildTestSpriteArgs(project, config);
  const env = {
    ...process.env,
    TESTSPRITE_API_KEY: config.apiKey
  };

  return runCommand(config.cliBin, args, env);
}

export async function createTestSpriteProjectCli(
  project: Project,
  targetUrl: string,
  config = readTestSpriteConfig()
): Promise<{ id: string; targetUrl: string; raw: unknown }> {
  const args = buildCreateProjectArgs(project, targetUrl);
  const result = await runCommand(config.cliBin, args, {
    ...process.env,
    TESTSPRITE_API_KEY: config.apiKey
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `TestSprite exited with code ${result.exitCode}`);
  }

  const raw = parseTestSpritePayload(result.stdout);
  const id = readProjectId(raw);
  if (!id) {
    throw new Error("TestSprite did not return a project id.");
  }

  return {
    id,
    targetUrl: readTargetUrl(raw) ?? targetUrl,
    raw
  };
}

export function buildTestSpriteArgs(project: Project, config: TestSpriteConfig): string[] {
  const timeout = Number.isFinite(config.timeoutSeconds) && config.timeoutSeconds > 0 ? String(config.timeoutSeconds) : "900";
  const args = ["--output", "json", "test"];

  if (config.testId) {
    args.push("run", config.testId, "--wait", "--timeout", timeout, "--target-url", project.url);
    return args;
  }

  args.push("rerun", "--all", "--project", config.projectId, "--wait", "--timeout", timeout);
  return args;
}

export function buildCreateProjectArgs(project: Project, targetUrl: string): string[] {
  return [
    "--output",
    "json",
    "project",
    "create",
    "--type",
    "frontend",
    "--name",
    project.name,
    "--url",
    targetUrl,
    "--description",
    `ShipShape launch audit for ${project.url}`
  ];
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<TestSpriteCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (exitCode) => {
      resolve({
        command: [command, ...args],
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

function readProjectId(raw: unknown): string | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const direct = raw.id;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const data = raw.data;
  if (isRecord(data) && typeof data.id === "string" && data.id.trim()) {
    return data.id;
  }

  const project = raw.project;
  if (isRecord(project) && typeof project.id === "string" && project.id.trim()) {
    return project.id;
  }

  return undefined;
}

function readTargetUrl(raw: unknown): string | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const direct = raw.targetUrl;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const data = raw.data;
  if (isRecord(data) && typeof data.targetUrl === "string" && data.targetUrl.trim()) {
    return data.targetUrl;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
