import os from "os";
import filePath from "path";
import type { Skills, TaskDefinition } from "../../types";
import { execSync } from "child_process";
import type { Browser } from "puppeteer-core";
import { readFileSync } from "fs";

export let BROWSER = {
  instance: null as Browser | null,
  isReady: false,
};

export const availableSkills: Skills = {
  readFile: {
    name: "readFile",
    description: "Read a file in the dir takes path to the file",
    parameters: {
      path: "string",
    },
    action: readFile,
  },
  writeFile: {
    name: "writeFile",
    description: "Write a file in the dir takes path to the file",
    parameters: {
      path: "string",
      data: "string",
    },
    action: writeFile,
  },
  runTerminalCommand: {
    name: "runTerminalCommand",
    description: "Run a terminal command takes command to run",
    parameters: {
      command: "string",
    },
    action: runTerminalCommand,
  },
  htmlDocumentToPdf: {
    name: "htmlDocumentToPdf",
    description:
      "Convert an HTML document to a PDF file takes path to the file and return the path to the PDF file",
    parameters: {
      inputPath: "string",
      outputPath: "string",
    },
    action: htmlDocumentToPdf,
  },
};

export function uploadSkills(): string {
  let skillSmd = readFileSync(
    filePath.resolve(__dirname, "skills.md"),
    "utf-8",
  );
  skillSmd = skillSmd.replace(
    "%osInfo%",
    JSON.stringify({
      name: os.type(),
      release: os.release(),
      arch: os.arch(),
      platform: os.platform(),
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
      uptime: os.uptime(),

      totalmem: os.totalmem(),
      cpus: os.cpus(),
      networkInterfaces: os.networkInterfaces(),
    }),
  );

  let skills = {} as any;
  for (const skill of Object.keys(availableSkills)) {
    const s = availableSkills[skill];
    const { name, description, parameters } = s as Skills[0];

    skills[skill] = { name, description, parameters };
  }
  skillSmd = skillSmd.replace("%skillsList%", JSON.stringify(skills));
  return skillSmd;
}

function readFile({ path }: Record<string, string>): {
  ok: boolean;
  data: string;
} {
  try {
    const fs = require("fs");
    //resolve absolute path

    path = filePath.resolve(path || "");
    const data = fs.readFileSync(path, "utf-8");
    return { ok: true, data };
  } catch (error: any) {
    return { ok: false, data: `${error.message}` };
  }
}

function writeFile({ path, data }: Record<string, string>): {
  ok: boolean;
  data: string;
} {
  try {
    const fs = require("fs");
    //resolve absolute path

    path = filePath.resolve(path || "");
    fs.writeFileSync(path, data, "utf-8");
    return { ok: true, data: "File written successfully" };
  } catch (error: any) {
    return { ok: false, data: `${error.message}` };
  }
}

function runTerminalCommand({ command }: Record<string, string>): {
  ok: boolean;
  data: string;
} {
  try {
    // Run the command in a shell, capture both stdout and stderr
    const output = execSync(command || "", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"], // capture stdout & stderr
      shell: true, // enable pipes, &&, etc.
    });

    return { ok: true, data: output.trim() };
  } catch (error: any) {
    // Try to get stderr first, then stdout, then generic message
    const data =
      (error.stderr && error.stderr.toString().trim()) ||
      (error.stdout && error.stdout.toString().trim()) ||
      error.message;

    // Optionally ignore harmless FUSE mount errors for commands like `df -h`
    const filteredData = data
      .replace(/\/run\/user\/\d+\/doc: Operation not permitted/g, "")
      .trim();

    return { ok: false, data: filteredData };
  }
}

async function htmlDocumentToPdf({
  inputPath,
  outputPath,
}: Record<string, string>) {
  try {
    let url = "";
    if (inputPath?.startsWith("http")) {
      url = inputPath;
    } else {
      const protocal = "file://";
      const absolutePath = filePath.resolve(inputPath || "");
      url = `${protocal}${absolutePath}`;
    }
    const page = await BROWSER.instance?.newPage();
    const absolutePath = filePath.resolve(outputPath || "");
    await page?.goto(url);
    await page?.pdf({ path: `${absolutePath}.pdf` });
    return { ok: true, data: absolutePath };
  } catch (error: any) {
    return { ok: false, data: `${error.message}` };
  }
}

export async function runSkill(task: TaskDefinition): Promise<{
  output: any;
  returnResponseToModel: boolean;
}> {
  const procedure = task.procedure;
  const output = {} as Record<string, { ok: boolean; data: any }>;
  let returnResponseToModel = false;
  for (const step of procedure) {
    const { skillName, input } = step;
    const skill = availableSkills[skillName];
    if (!skill) {
      output[step.stepId] = { ok: false, data: `Skill ${skillName} not found` };
      returnResponseToModel = true;
      console.error(`Skill ${skillName} not found`);
      break;
    }

    const params = {} as Record<string, any>;

    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;

      const element = input[key];
      if (typeof element == "object") {
        params[key] = output[element.fromStep]?.data;
      } else {
        params[key] = element;
      }

      const results = await skill.action(params);
      output[step.stepId] = results;
      returnResponseToModel = step.returnResultsToModel;
    }
  }
  return { output, returnResponseToModel };
}
