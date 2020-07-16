import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface LintArgs extends HandlerArgs {
  lintStaged: boolean;
}

const describe = "Lints and fixes source code.";

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs
    .positional("file", { describe: "file/dir/glob to pass to prettier to format.", type: "string" })
    .options({ "lint-staged": { type: "boolean", describe: "Optimizes command to be used with lint-staged." } })
    .strict(false);
  return localYargs;
};

async function handler({ intermodular, devkeeper, lintStaged, exitOnProcessFailure = true, ...extraArgs }: LintArgs): Promise<any> {
  // eslint --ignore-path .gitignore --cache --fix --max-warnings 0 --ext js,jsx,ts,tsx,vue src
  // If no files are provided to check, use default. (js, ts etc. are handled by eslint with prettier plugin.)
  const files = extraArgs?._?.[1] === undefined ? ["src"] : [];
  const args = lintStaged ? ["--cache", "--max-warnings", "0", "--fix"] : ["--cache", "--max-warnings", "0", "--ext", "js,jsx,ts,tsx,vue"];
  return intermodular.targetModule.execute("eslint", [...devkeeper.cleanArgs(extraArgs, { args }), ...files], { exitOnProcessFailure });
}

export { describe, builder, handler };
