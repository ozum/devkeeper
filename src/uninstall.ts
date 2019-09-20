import Intermodular from "intermodular";
import PackageUtil from "./package-util";

export default function uninstall(
  intermodular: Intermodular,
  { savePackage = true, uninstallPackages }: { savePackage?: boolean; uninstallPackages?: boolean } = {}
): void {
  const { sourceModule, targetModule } = intermodular;
  const packageUtil = new PackageUtil(intermodular);
  const targetPackage = targetModule.getDataFileSync("package.json");

  //
  // ─── REMOVE FILES ────────────────────────────────────────────────
  //
  packageUtil.modifications.files.forEach(file => {
    intermodular.targetModule.removeSync(file);
  });

  intermodular.targetModule.removeEmptyDirsSync("assets");

  //
  // ─── PACKAGE JSON ────────────────────────────────────────────────
  //
  packageUtil.uninstall();

  if (savePackage) {
    targetPackage.saveSync();
  }

  if (uninstallPackages && sourceModule.name !== targetModule.name) {
    targetModule.uninstall(packageUtil.addedDependencies);
  }
}
