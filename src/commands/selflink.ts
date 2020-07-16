import { promises } from "fs";
import { normalize } from "path";
import type { HandlerArgs } from "../utils/types";

const { symlink, unlink } = promises;

const describe = "Add 'devkeeper' symlink to 'node_module/.bin' if module targets devkeeper.";

async function handler({ intermodular }: HandlerArgs): Promise<void> {
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

export { describe, handler };
