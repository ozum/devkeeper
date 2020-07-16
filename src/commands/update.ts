import type Intermodular from "intermodular";
import { HandlerArgs } from "../utils/types";
import { updatePackage } from "../utils/package-json";

interface UpdateArgs extends HandlerArgs {
  force: boolean;
}

function getUpdateFunction(args: UpdateArgs) {
  return async (intermodular: Intermodular) => {
    const force: boolean = intermodular.sourceModule.name === intermodular.targetModule.name ? false : args.force;

    const [overwriteExists, dontOverwriteExists] = await Promise.all([
      intermodular.sourceModule.exists("module-files/overwrite"),
      intermodular.sourceModule.exists("module-files/dont-overwrite"),
    ]);

    await Promise.all([
      overwriteExists ? intermodular.copy("module-files/overwrite", ".", { overwrite: true }) : undefined,
      dontOverwriteExists ? intermodular.copy("module-files/dont-overwrite", ".", { overwrite: force }) : undefined,
    ]);
    return updatePackage(intermodular);
  };
}

const describe = "Updates package.json and configuration files.";
const builder = {
  force: { type: "boolean", describe: "Forces to overwrite existing files and configurations. (Some are overwritten even without force.)" },
};
async function handler(args: UpdateArgs): Promise<void> {
  args.intermodular.log("info", "Update started.");
  const update = getUpdateFunction(args);
  await args.devkeeper.doForEachPlugin(update);
  await args.devkeeper.fire("update", args);
  await args.intermodular.targetModule.saveAll();
  args.intermodular.log("info", "Update completed.");
}

export { describe, builder, handler };
