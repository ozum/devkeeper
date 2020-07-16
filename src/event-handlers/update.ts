import union from "lodash.union";
import type { HandlerArgs } from "../utils/types";

const spdxLicenseList = require("spdx-license-list/full"); // eslint-disable-line @typescript-eslint/no-var-requires

const packageJsonFiles = ["/bin", "/lib/**/!(*.spec|*.test)*.*", "/dist/**/!(*.spec|*.test)*.*", "/@types", "/module-files"];

export default async function handler({ intermodular }: HandlerArgs): Promise<void> {
  const { targetModule } = intermodular;

  const license = targetModule.package.get("license");
  targetModule.package.set("files", union(targetModule.package.get("files") || [], packageJsonFiles)); // Add `packageJsonFiles` to existing files.

  // const options = { if: (value?: string) => !value?.startsWith("devkeeper") };
  const options = { if: (value?: string) => value === undefined };
  targetModule.package.set("scripts.execute", "devkeeper execute", options);
  targetModule.package.set("scripts.build", "devkeeper build", options);
  targetModule.package.set("scripts.test", "devkeeper test", { if: (value) => value === 'echo "Error: no test specified" && exit 1' });
  targetModule.package.set("scripts.lint", "devkeeper lint", options);
  targetModule.package.set("scripts.format", "devkeeper format", options);
  targetModule.package.set("scripts.release", "devkeeper release", options);
  targetModule.package.set("scripts.readme", "devkeeper readme", options);

  targetModule.package.sortKeys("scripts", { start: ["execute", "build", "test", "lint", "format", "release", "readme"] });

  await Promise.all([
    intermodular.copy("module-files/.gitignore-for-target", ".gitignore", { overwrite: true }),
    targetModule.write("LICENSE", spdxLicenseList[license]?.licenseText, { overwrite: true, if: (content: any) => content !== undefined }),
  ]);
}
