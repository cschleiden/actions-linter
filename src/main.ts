import * as core from "@actions/core";

import {Context} from "github-actions-parser/dist/types";
import {context} from "@actions/github";
import {create} from "@actions/glob";
import {promises as fsPromises} from "fs";
import {issueCommand} from "@actions/core/lib/command";
import lineColumn from "line-column";
import {parse} from "github-actions-parser";

const {readFile} = fsPromises;

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", {required: true});
    const parserContext: Context = {
      owner: context.repo.owner,
      repository: context.repo.repo,
      client: undefined as any, // Disable dynamic features //  getOctokit(token) as Octokit,
      orgFeaturesEnabled: false,
    };

    const patterns = (JSON.parse(core.getInput("workflows")) as string[]) || [];
    const globber = await create(patterns.join("\n"));
    const files = await globber.glob();

    for (const file of files) {
      try {
        const workflowContent = await readFile(file, "utf-8");
        const workflow = await parse(parserContext, file, workflowContent);

        const lineColumnFinder = lineColumn(workflowContent);

        for (const diagnostic of workflow.diagnostics) {
          const {line, col} = lineColumnFinder.fromIndex(diagnostic.pos[0]) || {
            line: -1,
            col: -1,
          };

          issueCommand(
            diagnostic.kind === 0 /*DiagnosticKind.Error*/
              ? "error"
              : "warning",
            {
              file: file,
              line,
              col,
            },
            diagnostic.message,
          );
        }
      } catch (e) {
        core.error(`Could not parse ${file}: ${e.message}`);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
