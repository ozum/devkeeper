import type Intermodular from "intermodular";
import * as nunjucks from "nunjucks";
import * as path from "path";

const orderedKeys: Record<string, { ifNotExists?: boolean }> = {
  name: {},
  label: { ifNotExists: true },
  version: {},
  description: {},
  author: { ifNotExists: true },
  keywords: { ifNotExists: true },
  engines: {},
  source: {},
  types: {},
  main: {},
  module: {},
  "umd:main": {},
  files: {},
  bin: {},
  homepage: { ifNotExists: true },
  bugs: { ifNotExists: true },
  repository: { ifNotExists: true },
  license: { ifNotExists: true },
  scripts: {},
  shields: {},
  identities: {},
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
};

export async function updatePackage(intermodular: Intermodular): Promise<void> {
  if (!(await intermodular.sourceModule.exists("module-files/package-json/package.json"))) return;

  const targetPackage = intermodular.targetModule.package;
  const nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(intermodular.sourceModule.pathOf("module-files")));

  const packageData = JSON.parse(
    nunjucksEnv.render(path.join("package-json/package.json"), {
      intermodular,
      path,
      sourceModule: intermodular.sourceModule,
      targetModule: intermodular.targetModule,
    })
  );

  Object.entries(packageData).forEach(([key, value]) => {
    if (Array.isArray(value) || typeof value !== "object") {
      targetPackage.set(key, value, {
        if: (oldValue) => !orderedKeys[key]?.ifNotExists || oldValue === undefined,
        logger: intermodular.logger,
      });
      intermodular.log("verbose", `↳  New value is: ${value}`);
    } else {
      Object.entries(value as any).forEach(([objectKey, objectValue]: [string, any]) => {
        targetPackage.set([key, objectKey], objectValue, {
          if: (oldValue) => !orderedKeys[objectKey]?.ifNotExists || oldValue === undefined,
          logger: intermodular.logger,
        });
      });
    }
  });

  targetPackage.sortKeys([], { start: Object.keys(orderedKeys) });
  if (packageData.scripts) targetPackage.sortKeys("scripts", { start: Object.keys(packageData.scripts) });
}
