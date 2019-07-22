import { outdated } from "fast-outdated";
import * as path from "path";
import Intermodular, { LogLevel } from "intermodular";
import globby from "globby";

import cli from "cli-ux"; // eslint-disable-line import/no-extraneous-dependencies

const intermodular = new Intermodular();

async function updateModuleFilesPackages(): Promise<void> {
  // const rx = escapeRegExp("");
  const packageFilesDir = path.join(__dirname, "../../module-files/package-json");
  const packageFiles = await globby("**/package.json", { cwd: packageFilesDir });
  await Promise.all(
    packageFiles.map(async packageFile => {
      const cwd = path.join(packageFilesDir, path.dirname(packageFile));
      intermodular.log(`Checking ${path.dirname(packageFile)}...`, LogLevel.Info);
      const outdatedPackages = await outdated(cwd, { devDependencies: true });
      const { targetModule } = new Intermodular({ targetRoot: cwd });
      const targetPackage = targetModule.getDataFileSync("package.json");
      const dependencies = targetPackage.get("dependencies") || {};
      const devDependencies = targetPackage.get("devDependencies") || {};
      Object.entries(outdatedPackages).forEach(([name, version]) => {
        if (version.current !== version.wanted && !version.current.startsWith("github")) {
          if (dependencies[name]) {
            dependencies[name] = dependencies[name].replace(/\d.+/, version.wanted);
          }
          if (devDependencies[name]) {
            devDependencies[name] = devDependencies[name].replace(/\d.+/, version.wanted);
          }
          intermodular.log(`${name} version updated: ${version.current} ⟶ ${version.wanted}`);
        }
      });

      const data = Object.entries(outdatedPackages)
        .filter(([name, version]) => version.wanted !== version.latest) // eslint-disable-line @typescript-eslint/no-unused-vars
        .map(([name, version]) => ({ name, ...version }));

      if (data.length > 0) {
        intermodular.log("Outdated packages:", LogLevel.Warn);
        cli.table(data, { name: {}, current: {}, wanted: {}, latest: {} });
      }
      targetPackage.saveSync();
    })
  );
}

updateModuleFilesPackages();
