import type { HandlerArgs } from "../utils/types";

const describe = "Pulls source from git repository, adds all modified files, commits and push them to repository.";

async function handler({ devkeeper, intermodular, exitOnProcessFailure = true }: HandlerArgs): Promise<any> {
  await devkeeper.runCommand("readme");
  await intermodular.targetModule.command("git add README.md", { exitOnProcessFailure });

  // git pull && git add -A && git-cz && git push --follow-tags
  await intermodular.targetModule.command("git pull", { exitOnProcessFailure });
  await intermodular.targetModule.command("git add -A", { exitOnProcessFailure });
  await intermodular.targetModule.command("git commit", { exitOnProcessFailure });
  await intermodular.targetModule.command("git push --follow-tags", { exitOnProcessFailure });
}

export { describe, handler };
