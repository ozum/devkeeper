import Intermodular, { LogLevel } from "intermodular";
import { normalize, join } from "path";
import isEqual from "lodash.isequal";
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
  const features = ["common", ...(options.features || intermodular.targetModule.config.features || [])];

  uninstall(intermodular, { savePackage: false, uninstallPackages: false });

  //
  // ─── FILES ──────────────────────────────────────────────────────────────────────
  //

  features.forEach(feature => {
    const overwritePath = join("module-files/files/", normalize(feature), "overwrite");
    const dontOverwritePath = join("module-files/files/", normalize(feature), "dont-overwrite");
    addedFiles.push(...intermodular.copySync(overwritePath, ".")); // Copy files, and add them to modifications.
    intermodular.copySync(dontOverwritePath, ".", { overwrite: false }); // Do not add non-overridable files to modifications.
  });

  targetModule.renameSync(".gitignore-to-rename", ".gitignore"); // npm automatically converts .gitginore to .npmignore while publishing. So, to prevent this file is named as `.gitignore-to-rename`.

  //
  // ─── COSMICONFIG ────────────────────────────────────────────────────────────────
  //
  const config = targetModule.getDataFileSync(`.${sourceModule.nameWithoutUser}rc.json`);
  config.set("test.coverageThreshold", 100, { ifNotExists: true });
  config.saveSync();
  targetModule.reloadConfig();

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
  // ─── JEST ───────────────────────────────────────────────────────────────────────
  //

  const coverageThreshold = config.get("test.coverageThreshold") || 100;
  const jestConfig = targetModule.getDataFileSync(`jest.config.json`);
  jestConfig.set("coverageThreshold", {
    global: {
      branches: coverageThreshold,
      functions: coverageThreshold,
      lines: coverageThreshold,
      statements: coverageThreshold,
    },
  });
  jestConfig.saveSync();

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
}
