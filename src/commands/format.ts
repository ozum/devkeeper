import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface FormatArgs extends HandlerArgs {
  lintStaged: boolean;
}

const describe = "Formats source code.";

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs
    .options({ "lint-staged": { type: "boolean", describe: "Optimizes command to be used with lint-staged." } })
    .positional("file", { describe: "file/dir/glob to pass to prettier to format.", type: "string" })
    .strict(false);
  return localYargs;
};

async function handler({
  intermodular,
  devkeeper,
  lintStaged = false,
  exitOnProcessFailure = true,
  ...extraArgs
}: FormatArgs): Promise<any> {
  // prettier --ignore-path .gitignore --write './**/*.+(json|less|css|md|gql|graphql|html|yaml)'
  // If no files are provided to check, use default. (js, ts etc. are handled by eslint with prettier plugin.)
  const files = extraArgs?._?.[1] === undefined ? ["{*,**/*}.{json,less,css,md,gql,graphql,html,yaml}"] : [];

  const args = lintStaged
    ? ["--config", "prettier.config.js", "--ignore-path", ".eslintignore", "--write"]
    : ["--config", "prettier.config.js", "--ignore-path", ".eslintignore", "--check"];

  return intermodular.targetModule.execute("prettier", [...devkeeper.cleanArgs(extraArgs, { args }), ...files], { exitOnProcessFailure });
}

export { describe, builder, handler };
