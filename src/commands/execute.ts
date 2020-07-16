import type yargs from "yargs";
import type { HandlerArgs } from "../utils/types";

interface RunArgs extends HandlerArgs {
  lintStaged: boolean;
  source: string;
}

const describe = 'Executes a TypeScript file using "ts-node-dev". Extra options passed to "ts-node-dev".';

const builder = (localYargs: typeof yargs): typeof yargs => {
  localYargs
    .options({ watch: { type: "boolean", describe: "Watches file changes and executes file if it changes.", default: true } })
    .positional("source", { describe: "Source file to execute.", type: "string", demandOption: true })
    .strict(false);
  return localYargs;
};

async function handler({ intermodular, devkeeper, watch, exitOnProcessFailure = true, ...extraArgs }: RunArgs): Promise<any> {
  const args = watch ? ["--no-notify", "--respawn", "--transpileOnly", "--compiler-options", '{ "module": "commonjs" }'] : [];

  return intermodular.targetModule.execute("ts-node-dev", devkeeper.cleanArgs(extraArgs, { args, exclude: ["watch"] }), {
    exitOnProcessFailure,
  });
}

export { describe, builder, handler };
