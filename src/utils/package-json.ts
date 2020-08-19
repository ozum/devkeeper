/* eslint-disable import/no-duplicates */
import type Intermodular from "intermodular";
import type { DataFile } from "intermodular";
import * as nunjucks from "nunjucks";
import * as path from "path";
import difference from "lodash.difference";
import union from "lodash.union";
import isEqual from "lodash.isequal";

type Options = { overwrite?: boolean; merge?: boolean };

const ORDERED_PACKAGE_KEYS: Record<string, Options> = {
  name: {},
  label: {},
  version: {},
  description: {},
  author: {},
  keywords: {},
  engines: { overwrite: true },
  source: { overwrite: true },
  main: { overwrite: true },
  types: { overwrite: true },
  module: { overwrite: true },
  "umd:main": { overwrite: true },
  files: { merge: true },
  bin: { overwrite: true },
  homepage: {},
  bugs: {},
  repository: {},
  license: {},
  scripts: { merge: true },
  shields: { merge: true },
  identities: { overwrite: true },
  dependencies: { merge: true },
  devDependencies: { merge: true },
  peerDependencies: { merge: true },
  optionalDependencies: { merge: true },
};

const DEFAULT_VALUES: Record<string, any> = {
  "scripts.test": 'echo "Error: no test specified" && exit 1',
};

/** Renders nunjucks template of `module-files/files/package-json/package.json` from source module and rparsed returned JSON. */
export async function parseSourcePackageData(intermodular: Intermodular): Promise<Record<string, any>> {
  if (!(await intermodular.sourceModule.exists("module-files/package-json/package.json"))) return {};

  const nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(intermodular.sourceModule.pathOf("module-files")));

  const packageData: Record<string, any> = JSON.parse(
    nunjucksEnv.render(path.join("package-json/package.json"), {
      intermodular,
      path,
      sourceModule: intermodular.sourceModule,
      targetModule: intermodular.targetModule,
    })
  );

  return packageData;
}

function updateArray(intermodular: Intermodular, registry: DataFile, key: string, value: any[]): void {
  const targetPackage = intermodular.targetModule.package;

  const options = ORDERED_PACKAGE_KEYS[key];
  if (options.merge) {
    const oldValue = targetPackage.get(key);
    const previouslyAddedValues = registry.get(["addedData", "package.json", key]);
    const addedValues = difference(value, oldValue);
    targetPackage.set(key, union(oldValue, value), { logger: intermodular.logger });
    registry.set(["addedData", "new", "package.json", key], union(previouslyAddedValues, addedValues));
  } else if (value === undefined || options.overwrite) {
    targetPackage.set(key, value, { logger: intermodular.logger });
    registry.set(["addedData", "new", "package.json", key], value);
  }
}

function updateObject(intermodular: Intermodular, registry: DataFile, key: string, value: Record<string, any>): void {
  const targetPackage = intermodular.targetModule.package;
  const options = ORDERED_PACKAGE_KEYS[key];

  if (options.merge) {
    Object.entries(value).forEach(([subKey, subValue]) => {
      const oldSubValue = targetPackage.get([key, subKey]);
      if (options.overwrite || oldSubValue === undefined || oldSubValue === DEFAULT_VALUES[`${key}.${subKey}`]) {
        targetPackage.set([key, subKey], subValue, { logger: intermodular.logger });
        registry.set(["addedData", "new", "package.json", `${key}.${subKey}`], subValue);
        registry.set(["addedData", "old", "package.json", `${key}.${subKey}`], oldSubValue);
      }
    });
  } else if (options.overwrite || value === DEFAULT_VALUES[key]) {
    const oldValue = targetPackage.get(key);
    // console.log(key, targetPackage.get(key), oldValue);
    targetPackage.set(key, value, { logger: intermodular.logger });
    registry.set(["addedData", "new", "package.json", key], value);
    registry.set(["addedData", "old", "package.json", key], oldValue);
  }
}

function updateScalar(intermodular: Intermodular, registry: DataFile, key: string, value: any): void {
  const targetPackage = intermodular.targetModule.package;
  const oldValue = targetPackage.get(key);
  if (ORDERED_PACKAGE_KEYS[key].overwrite || oldValue === undefined || oldValue === DEFAULT_VALUES[key]) {
    targetPackage.set(key, value, { logger: intermodular.logger });
    registry.set(["addedData", "new", "package.json", key], value);
    registry.set(["addedData", "old", "package.json", key], oldValue);
  }
}

export async function updatePackage(intermodular: Intermodular, registry: DataFile): Promise<void> {
  const sourcePackageData = await parseSourcePackageData(intermodular);
  const targetPackage = intermodular.targetModule.package;

  Object.entries(sourcePackageData).forEach(([key, value]) => {
    if (Array.isArray(value)) updateArray(intermodular, registry, key, value);
    else if (typeof value === "object") updateObject(intermodular, registry, key, value);
    else updateScalar(intermodular, registry, key, value);
    intermodular.log("verbose", `↳  New value is: ${value}`);
  });

  targetPackage.sortKeys([], { start: Object.keys(ORDERED_PACKAGE_KEYS) });
  if (sourcePackageData.scripts) targetPackage.sortKeys("scripts", { start: Object.keys(sourcePackageData.scripts) });
}

export async function uninstallPackage(intermodular: Intermodular, registry: DataFile): Promise<void> {
  const oldDataPath = ["addedData", "old", "package.json"];
  const newDataPath = ["addedData", "new", "package.json"];

  const oldValues = registry.get(oldDataPath);
  const newValues = registry.get(newDataPath);

  const targetPackage = intermodular.targetModule.package;

  Object.entries(newValues || {}).forEach(([key, newValue]) => {
    const oldValue = oldValues[key];
    const packageValue = targetPackage.get(key.split("."));

    if (isEqual(newValue, packageValue)) {
      if (oldValue === undefined) targetPackage.delete(key, { logger: intermodular.logger });
      else targetPackage.set(key, oldValue, { logger: intermodular.logger });

      registry.delete([...oldDataPath, key]);
      registry.delete([...newDataPath, key]);
    } else {
      intermodular.log("warn", `Package key not uninstalled: ${key}. It is changed by user.`);
    }
  });

  if (isEqual(newValues, {})) registry.delete(newDataPath);
  if (isEqual(oldValues, {})) registry.delete(oldDataPath);
}
