import Intermodular, { LogLevel } from "intermodular";
import { normalize, join } from "path";
import PackageUtil from "./package-util";
import uninstall from "./uninstall";

interface UpdateOptions {
  addDependencies?: boolean;
  features?: string[];
}

export default function update(intermodular: Intermodular, options: UpdateOptions): void {
  const { sourceModule, targetModule } = intermodular;
  const packageUtil = new PackageUtil(intermodular);
  const targetPackage = targetModule.getDataFileSync("package.json");
  const addedFiles = [".gitignore"];
  const extraFeatures = [...(options.features || []), ...(intermodular.targetModule.config.features || [])];
  const features = ["common", ...extraFeatures];

  uninstall(intermodular, { savePackage: false, uninstallPackages: false });

  //
  // ─── FILES ──────────────────────────────────────────────────────────────────────
  //

  features.forEach((feature) => {
    const overwritePath = join("module-files/files/", normalize(feature), "overwrite");
    const dontOverwritePath = join("module-files/files/", normalize(feature), "dont-overwrite");
    if (sourceModule.existsSync(overwritePath)) {
      addedFiles.push(...intermodular.copySync(overwritePath, ".")); // Copy files, and add them to modifications.
    }
    if (sourceModule.existsSync(dontOverwritePath)) {
      intermodular.copySync(dontOverwritePath, ".", { overwrite: false }); // Do not add non-overridable files to modifications.
    }
  });

  targetModule.renameSync(".gitignore-to-rename", ".gitignore"); // npm automatically converts .gitginore to .npmignore while publishing. So, to prevent this file is named as `.gitignore-to-rename`.

  //
  // ─── COSMICONFIG ────────────────────────────────────────────────────────────────
  //
  const config = targetModule.getDataFileSync(`.${sourceModule.nameWithoutUser}rc.json`);
  config.set(
    ["files", "jest.config.json", "coverageThreshold"],
    { global: { branches: 100, functions: 100, lines: 100, statements: 100 } },
    { ifNotExists: true }
  );
  if (extraFeatures.length > 0) {
    config.set("features", [...new Set(extraFeatures)]);
  }
  config.saveSync();
  targetModule.reload();

  //
  // ─── LICENSE ────────────────────────────────────────────────────────────────────
  //

  try {
    if (!targetPackage.get("license").startsWith("SEE LICENSE IN")) {
      targetModule.executeSync("licensor", ["--width", "80"], {
        stdio: ["ignore"],
      });
    }
  } catch (e) {
    intermodular.log("License file cannot be created.", LogLevel.Error);
  }

  //
  // ─── PACKAGE.JSON ───────────────────────────────────────────────────────────────
  //
  packageUtil.update({
    addDependencies: options.addDependencies,
    files: addedFiles,
    features,
  });
  targetPackage.saveSync();

  if (options.addDependencies && packageUtil.dependenciesChanged) {
    targetModule.install();
  }
  targetModule.reload();

  //
  // ─── UPDATE CONFIG FILES ────────────────────────────────────────────────────────
  //
  // Read `files` key from `.devkeeper.json` and update all files with given data.
  const configFiles = config.get("files");
  if (configFiles && typeof configFiles === "object") {
    Object.keys(configFiles).forEach((filePath) => {
      const dataFile = targetModule.getDataFileSync(filePath);
      Object.keys(configFiles[filePath]).forEach((objectPath) => {
        const objectPathArray = objectPath.includes(".") ? objectPath.split(".") : [objectPath];
        dataFile.assign(objectPathArray, configFiles[filePath][objectPath]);
      });
      dataFile.saveSync();
    });
  }

  if (targetModule.hasAnyDependency("tslib")) {
    const tsconfig = targetModule.getDataFileSync("tsconfig.json");
    tsconfig.set("importHelpers", true);
    tsconfig.saveSync();
  }
}
