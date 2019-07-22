import { Command, flags } from "@oclif/command";
import Intermodular from "intermodular";
import { BIN } from "../utils";
import update from "../update";

export default class Update extends Command {
  public static description =
    "Updates node module development environment by adding configuration files installing development dependencies and modifying 'package.json' file.";

  public static examples = [`$ ${BIN} update`, `$ ${BIN} update --features vuepress`];

  public static flags = {
    help: flags.help({ char: "h" }),
    addDependencies: flags.boolean({ char: "d", description: "Add dependencies to 'package.json'" }),
    features: flags.string({ char: "f", description: "(CSV) Features to add. ('vuepress')" }),
  };

  public async run(): Promise<void> {
    // eslint-disable-next-line no-shadow
    const { flags } = this.parse(Update);
    update(new Intermodular({ overwrite: true }), {
      addDependencies: flags.addDependencies,
      features: flags.features ? flags.features.split(",") : undefined,
    });
  }
}
