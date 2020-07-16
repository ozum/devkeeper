import { join, sep } from "path";
import readmeasy from "readmeasy";
import type yargs from "yargs";
import { promises } from "fs";
import os from "os";
import type { HandlerArgs } from "../utils/types";

const { mkdtemp } = promises;

const describe = "Creates README.md from README.njk template.";

function builder(localYargs: yargs.Argv): yargs.Argv {
  return localYargs.recommendCommands().strict(false).showHelpOnFail(true);
}

/**
 * Creates TypeDoc HTML files from TypeScript source files.
 *
 * @param intermodular is the {@link https://intermodular.ozum.net/ intermodular} object to operate on.
 * @param out is output directory for generated HTML files.
 * @param extraArgs are arguments passed to `typedoc` command.
 */
async function handler({ intermodular, devkeeper, exitOnProcessFailure = true, ...extraArgs }: HandlerArgs): Promise<any> {
  // if grep -q '{% include \"api.md\" %}' 'README.njk'; then npm run typedoc:single-md; mkdir -p temp && mv api.md temp/; fi && readmeasy --partial-dirs temp,/module-files/template-partials && rm -rf temp
  const { targetModule } = intermodular;
  const partialDirs = [intermodular.sourceModule.pathOf("module-files/template-partials")];
  const template = (await targetModule.read("README.njk")) as string;

  // If remplate contains API partial or template does not exist (default template contains API partial), create API markdown.
  if (template.includes('{% include "api.md" %}')) {
    const apiDir = await mkdtemp(`${os.tmpdir}${sep}`);
    partialDirs.push(apiDir);
    await devkeeper.runCommand("typedoc/md", { out: join(apiDir, "api.md"), singleFile: true, ...extraArgs });
  }

  await readmeasy({ partialDirs, dir: intermodular.targetModule.root });

  // If oclif installed execute `oclif-dev readme`;
  if (targetModule.hasAnyDependency(["@oclif/command"])) await targetModule.command("oclif-dev readme", { exitOnProcessFailure });

  intermodular.log("info", "README created: README.md");
}

export { describe, builder, handler };
