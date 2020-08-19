/* eslint-disable import/no-duplicates */
import type Intermodular from "intermodular";
import type { DataFile } from "intermodular";
import union from "lodash.union";
import { HandlerArgs } from "../utils/types";
import { updatePackage } from "../utils/package-json";

const spdxLicenseList = require("spdx-license-list/full"); // eslint-disable-line @typescript-eslint/no-var-requires

interface UpdateArgs extends HandlerArgs {
  force: boolean;
}

async function copyFiles(intermodular: Intermodular, registry: DataFile, force: boolean): Promise<void> {
  const [overwriteExists, dontOverwriteExists] = await Promise.all([
    intermodular.sourceModule.exists("module-files/overwrite"),
    intermodular.sourceModule.exists("module-files/dont-overwrite"),
  ]);

  const copyResults = await Promise.all([
    overwriteExists ? intermodular.copy("module-files/overwrite", ".", { overwrite: true, excludeDirFromReturn: true }) : [],
    dontOverwriteExists ? intermodular.copy("module-files/dont-overwrite", ".", { overwrite: force, excludeDirFromReturn: true }) : [],
  ]);

  const registryKey = ["addedFiles", intermodular.sourceModule.name];
  const previouslyAddedFiles = registry.get(registryKey) || [];
  registry.set(registryKey, union(previouslyAddedFiles, copyResults.flat()));
}

async function update(args: UpdateArgs): Promise<void> {
  const { intermodular } = args;
  const force: boolean = intermodular.sourceModule.name === intermodular.targetModule.name ? false : args.force;
  const registry = await intermodular.targetModule.readData(".devkeeper.registry.json");

  await copyFiles(intermodular, registry, force);
  await updatePackage(intermodular, registry);
}

const describe = "Updates package.json and configuration files.";
const builder = {
  force: { type: "boolean", describe: "Forces to overwrite existing files and configurations. (Some are overwritten even without force.)" },
};

async function handler(args: UpdateArgs): Promise<void> {
  const { intermodular, devkeeper } = args;
  intermodular.log("info", "Update started.");

  const license = intermodular.targetModule.package.get("license");

  await Promise.all([
    devkeeper.doForEachPlugin(update, args),
    intermodular.copy("module-files/.gitignore-for-target", ".gitignore", { overwrite: true }),
    intermodular.targetModule.write("LICENSE", spdxLicenseList[license]?.licenseText, { overwrite: true }), // if: (content: any) => content !== undefined,
    devkeeper.fire("update", args),
  ]);

  await intermodular.targetModule.saveAll();
  intermodular.log("info", "Update completed.");
}

export { describe, builder, handler };
