import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface FormatArgs extends HandlerArgs {
  lintStaged: boolean;
}

const describe = "Formats source code.";

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs.options({ "lint-staged": { type: "boolean", describe: "Optimizes command to be used with lint-staged." } }).strict(false);
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
  const args = lintStaged ? ["--ignore-path", ".eslintignore", "--write"] : ["--ignore-path", ".eslintignore", "--check"];
  const files = ['"src/**/*.+(json|less|css|md|gql|graphql|html|yaml)"', "package.json"];
  return intermodular.targetModule.execute("prettier", [...devkeeper.cleanArgs(extraArgs, { args }), ...files], { exitOnProcessFailure });
}

export { describe, builder, handler };
