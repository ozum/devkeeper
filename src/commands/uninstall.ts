import { join } from "path";
import difference from "lodash.difference";
import isEqual from "lodash.isequal";
import { HandlerArgs } from "../utils/types";
import { uninstallPackage } from "../utils/package-json";

async function deleteFiles(args: HandlerArgs): Promise<void> {
  const { intermodular } = args;
  const registry = await intermodular.targetModule.readData(".devkeeper.registry.json");
  const registryKey = ["addedFiles", intermodular.sourceModule.name];
  const registryFiles = registry.get(registryKey);
  if (!registryFiles) return;

  const deletedFiles = await Promise.all(
    (registryFiles || []).map(async (targetFile: string) => {
      const sourceFile = (await intermodular.targetModule.exists(join("module-files/overwrite", targetFile)))
        ? join("module-files/overwrite", targetFile)
        : join("module-files/dont-overwrite", targetFile);

      const isEquivalent = await intermodular.areEquivalentFiles(sourceFile, targetFile);
      if (isEquivalent) return intermodular.targetModule.remove(targetFile);
      return intermodular.log("warn", `File not removed: '${targetFile}' is modified by user.`);
    })
  );

  const remainingFiles = difference(registryFiles, deletedFiles);
  if (remainingFiles.length === 0) registry.delete(registryKey);
  else registry.set(registryKey, remainingFiles);
}

async function cleanRegistry(args: HandlerArgs): Promise<void> {
  const { intermodular } = args;
  const registry = await intermodular.targetModule.readData(".devkeeper.registry.json");
  registry.deleteEmptyPath("addedData.old");
  registry.deleteEmptyPath("addedData.new");
  registry.deleteEmptyPath(["addedFiles", intermodular.sourceModule.name]);
}

async function uninstall(args: HandlerArgs): Promise<void> {
  const { intermodular } = args;
  const registry = await intermodular.targetModule.readData(".devkeeper.registry.json");

  await deleteFiles(args);
  await uninstallPackage(intermodular, registry);
  await cleanRegistry(args);
}

const describe = "Uninstalls devkeeper and undoes not modified files and entries.";

async function handler(args: HandlerArgs): Promise<void> {
  const { intermodular, devkeeper } = args;
  const registry = await intermodular.targetModule.readData(".devkeeper.registry.json");

  intermodular.log("info", "Uninstall started.");
  await Promise.all([devkeeper.doForEachPlugin(uninstall, args), devkeeper.fire("uninstall", args)]);
  await intermodular.targetModule.saveAll();

  if (isEqual(registry.data, {})) await intermodular.targetModule.remove(".devkeeper.registry.json");

  intermodular.log("info", "Uninstall completed.");
}

export { describe, handler };
