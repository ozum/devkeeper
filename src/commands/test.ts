import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface LintArgs extends HandlerArgs {
  lintStaged: boolean;
}

const describe = "Tests code. Additional flags are passed to Jest.";

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs.options({ "lint-staged": { type: "boolean", describe: "Optimizes command to be used with lint-staged." } }).strict(false);
  return localYargs;
};

async function handler({ intermodular, lintStaged, devkeeper, exitOnProcessFailure = true, ...extraArgs }: LintArgs): Promise<any> {
  // jest --bail --coverage --findRelatedTests --config=jest.config.js
  const args = lintStaged ? ["--bail", "--coverage", "--findRelatedTests", "--config", "jest.config.js"] : ["--coverage"];
  await intermodular.targetModule.execute("jest", devkeeper.cleanArgs(extraArgs, { args, exclude: ["lintStaged"] }), {
    env: { NODE_ENV: "test" },
    exitOnProcessFailure,
  });
}

export { describe, builder, handler };
