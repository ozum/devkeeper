import { Command, flags } from "@oclif/command";
import Intermodular from "intermodular";
import { BIN } from "../utils";
import uninstall from "../uninstall";

export default class Uninstall extends Command {
  public static description = "Uninstall files and configuration added previously.";

  public static examples = [`$ ${BIN} uninstall`];

  public static flags = {
    help: flags.help({ char: "h" }),
  };

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    // eslint-disable-next-line no-shadow
    // const { args, flags } = this.parse(Uninstall);
    uninstall(new Intermodular({ overwrite: true }), { uninstallPackages: true });
  }
}
