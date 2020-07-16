import { join, sep } from "path";
import Intermodular, { Module } from "intermodular";
import { promises } from "fs";
import os from "os";
import parentModule from "parent-module";
import Devkeeper from "../devkeeper";

const { mkdir, mkdtemp, copyFile, symlink, readFile } = promises;

const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
  ].join("|"),
  "g"
);

/**
 * Helper class to test devkeeper plugin.
 */
export default class PluginTestHelper {
  private static pluginRoot: string;
  private static pluginName: string;
  private static plugins: any;

  private devkeeper: Devkeeper;
  public targetModule: Module;

  private constructor(devkeeper: Devkeeper, targetModule: Module) {
    this.devkeeper = devkeeper;
    this.targetModule = targetModule;
  }

  /**
   * Copies target module used for testing to a temporary directory and returns devkeeper for copied module.
   * Also creates symbolic link to from target module's `node_modules` to tested plugin's `node_modules` directory,
   * because to test plugin, it should be installed to target module.
   *
   * @returns `Devkeeper` for temporary taget module and path of the target module root.
   */
  public static async create(moduleName: string): Promise<PluginTestHelper> {
    if (!this.pluginRoot) {
      const pluginRoot = parentModule()?.replace(/\/test\/.+$/, "");
      if (!pluginRoot) throw new Error("Cannet determine plugin root.");
      this.pluginRoot = pluginRoot;
      this.pluginName = JSON.parse(await readFile(join(pluginRoot, "package.json"), { encoding: "utf8" })).name;
      this.plugins = { [this.pluginName]: join(pluginRoot, "src") };
    }

    const tmpDir = await mkdtemp(`${os.tmpdir}${sep}`);
    const cwd = join(tmpDir, moduleName);
    const { plugins } = PluginTestHelper;
    await mkdir(cwd);
    await copyFile(join(PluginTestHelper.pluginRoot, "test/test-helper", moduleName, "package.json"), join(cwd, "package.json"));

    const devkeeper = await Devkeeper.new({
      plugins,
      cwd,
      plugin: PluginTestHelper.pluginName,
      stdio: "pipe", // "inherit" for console, "pipe" to capture.
      logLevel: "error",
      colorizeLogs: false,
    });

    const intermodular = await Intermodular.new({
      source: join(PluginTestHelper.pluginRoot, "test/test-helper", moduleName),
      target: devkeeper.targetModule,
    });

    await intermodular.copy(".", ".");
    await symlink(join(PluginTestHelper.pluginRoot, "node_modules"), join(cwd, "node_modules"));

    return new PluginTestHelper(devkeeper, devkeeper.targetModule);
  }

  /**
   * Executes given command and returns it's stdout if command exits with exit code other than 0.
   *
   * @param devkeeper is the `Devkeeper` to execute command.
   * @param command is the command to execute and arguments.
   * @param args are the arguments of the command.
   */
  public async runCommand(command: string, args?: Record<string, any>): Promise<string | any | undefined> {
    let result;
    try {
      result = await this.devkeeper.runCommand(command, { exitOnProcessFailure: false, ...args });
    } catch (error) {
      if (!Object.prototype.hasOwnProperty.call(error, "stdout")) throw error;
      result = error;
    }

    if (result?.stdout) result.stdout = result.stdout.replace(ANSI_REGEX, "");
    return result;
  }
}
