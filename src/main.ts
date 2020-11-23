import * as core from "@actions/core";
import {issueCommand} from "@actions/core/lib/command";
import {context, getOctokit} from "@actions/github";
import {create} from "@actions/glob";
import {Octokit} from "@octokit/rest";
import {promises as fsPromises} from "fs";
import {parse} from "github-actions-parser";
import {Context} from "github-actions-parser/dist/types";
import lineColumn from "line-column";
const {readFile} = fsPromises;

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", {required: true});
    const parserContext: Context = {
      owner: context.repo.owner,
      repository: context.repo.repo,
      client: getOctokit(token) as Octokit,
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
