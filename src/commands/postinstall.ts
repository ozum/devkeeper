import { promises } from "fs";
import { normalize } from "path";
import type Intermodular from "intermodular";
import type { HandlerArgs } from "../utils/types";

const { symlink, unlink } = promises;

const describe = "Execute postinstall jobs.";

/** Add 'devkeeper' symlink to 'node_module/.bin' if module targets devkeeper. */
async function selfLink(intermodular: Intermodular): Promise<void> {
  // ln -s ../../bin/run node_modules/.bin/devkeeper
  const src = normalize("../../bin/run");
  const bin = intermodular.targetModule.pathOf("node_modules/.bin/devkeeper");

  if (intermodular.targetModule.name === "devkeeper") {
    try {
      await unlink(bin);
    } catch (error) {
      if (error.code !== "ENOENT") throw Error;
    }
    await symlink(src, bin);
    intermodular.log("info", `devkeeper command added to "node_modules/.bin"`);
  }
}

async function handler({ intermodular }: HandlerArgs): Promise<void> {
  await selfLink(intermodular);
  intermodular.targetModule.package.set("scripts.keep", "devkeeper update");
  await intermodular.targetModule.saveAll();
}

export { describe, handler };
