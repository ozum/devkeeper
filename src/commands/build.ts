import type { HandlerArgs } from "../utils/types";

const describe = "Builds source code.";

async function handler({ intermodular, devkeeper, exitOnProcessFailure = true, ...extraArgs }: HandlerArgs): Promise<any> {
  return intermodular.targetModule.execute("tsc", devkeeper.cleanArgs(extraArgs, { args: ["--incremental"] }), { exitOnProcessFailure });
}

export { describe, handler };
