import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface LintArgs extends HandlerArgs {
  lintStaged: boolean;
}

const describe = "Lints and fixes source code.";

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs.options({ "lint-staged": { type: "boolean", describe: "Optimizes command to be used with lint-staged." } }).strict(false);
  return localYargs;
};

async function handler({ intermodular, devkeeper, lintStaged, exitOnProcessFailure = true, ...extraArgs }: LintArgs): Promise<any> {
  // eslint --ignore-path .gitignore --cache --fix --max-warnings 0 --ext js,jsx,ts,tsx,vue src
  const args = lintStaged
    ? devkeeper.cleanArgs(extraArgs, { args: ["--cache", "--max-warnings", "0", "--fix"], exclude: ["lintStaged"] })
    : [...devkeeper.cleanArgs(extraArgs, { args: ["--cache", "--max-warnings", "0", "--ext", "js,jsx,ts,tsx,vue"] }), "src"];

  return intermodular.targetModule.execute("eslint", args, { exitOnProcessFailure });
}

export { describe, builder, handler };
