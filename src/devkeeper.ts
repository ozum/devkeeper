/* eslint-disable no-restricted-syntax, class-methods-use-this */
import Intermodular, { Module, LogLevel, StdioOption } from "intermodular";
import { createLogger, format, transports, Logger } from "winston";
import { join, dirname, extname, basename } from "path";
import decamelize from "decamelize";
import mapToObject from "array-map-to-object";
import { Plugins, Handler, Handlers } from "./utils/types"; // eslint-disable-line import/order
import readdirp = require("readdirp");
import yargsParser = require("yargs/yargs");
import yargs = require("yargs");

type ExtendedYargs = typeof yargs & { commandPlugins?: Record<string, string> };
type Argv = yargs.Arguments<{ intermodular: Intermodular; logLevel: LogLevel; [key: string]: any }>;

function fixedLength(text: string, length: number, finalText = text): string {
  return `${finalText}${" ".repeat(Math.max(length - text.length, 0))}`;
}

function findLogLevel(args = process.argv): LogLevel | undefined {
  const logLevelArgIndex = args.findIndex((value) => value === "--logLevel" || value === "--log-level");
  return logLevelArgIndex > -1 ? (args[logLevelArgIndex + 1] as LogLevel) : undefined;
}

async function getPlugins(targetModule: Module, prefix: string, { plugins }: { plugins?: Plugins }): Promise<Plugins> {
  const pluginNames = Object.keys(targetModule.package.get("devDependencies") || []).filter((dep: string) => dep.startsWith(prefix));
  const packagePlugins: Plugins = mapToObject(pluginNames, (pluginName) => [pluginName, dirname(require.resolve(pluginName))]);
  const allPlugins: Plugins = { devkeeper: __dirname, ...plugins, ...packagePlugins };

  // If target module is a plugin, use itself. Feed your own food.
  if (targetModule.name.startsWith(prefix)) {
    const sourceDir = process.argv[0].endsWith("ts-node") ? "src" : "dist";
    if (sourceDir === "dist" && !(await targetModule.exists(sourceDir))) await targetModule.execute("tsc");
    allPlugins[targetModule.name] = targetModule.pathOf(sourceDir);
  }
  return allPlugins;
}

function getLogger(logLevel: LogLevel, pluginNames: string[], prefix: string, colorizeLogs: boolean, pluginName?: string): Logger {
  if (pluginName === "devkeeper") pluginName = undefined; // eslint-disable-line no-param-reassign
  const { combine, colorize, printf } = format;
  const maxLength = pluginNames.reduce((length, name) => Math.max(length, name.replace(prefix, "").replace("devkeeper", "").length), 0);
  const additionalSpace = "devkeeper".length + pluginNames.length * 3 - 1;

  const myFormat = printf((o) => {
    const rawLevel = o[Symbol.for("level") as any];
    return `${fixedLength(o.label, maxLength + additionalSpace)} ${fixedLength(rawLevel, 8, `${o.level}:`)} ${o.message}`;
  });

  const label = `[devkeeper]${pluginName ? ` [${pluginName.replace(prefix, "")}]` : ""}`; // [im] or [im] [plugin name]

  const logFormat = [format.label({ label }), myFormat];
  if (colorizeLogs) logFormat.unshift(colorize());

  return createLogger({
    level: logLevel,
    format: combine(...logFormat),
    transports: [new transports.Console()],
  });
}

async function getHandlers(plugins: Plugins, handlerDir: "commands" | "event-handlers"): Promise<any> {
  const handlers: Handlers = {};
  const importKey = handlerDir === "commands" ? "handler" : "default";
  await Promise.all(
    Object.entries(plugins).map(async ([pluginName, srcDir]) => {
      const dir = join(srcDir, handlerDir);
      // Glob for: ".js" and ".ts", but not ".d.ts"
      for await (const { path } of readdirp(dir, { fileFilter: "**/!(*.d).{js,ts}" })) {
        const name = path.replace(extname(path), "");
        const handler = (await import(join(dir, path)))[importKey];

        if (typeof handler === "function") {
          if (!handlers[name]) handlers[name] = {};
          handlers[name][pluginName] = handler;
        }
      }
    })
  );
  return handlers;
}

export default class Devkeeper {
  readonly #intermodulars: Record<string, Intermodular> = {}; // { pluginName: intermodular }
  readonly #logLevel: LogLevel;
  readonly #plugins: Plugins = {};
  readonly #prefix: string;
  readonly #stdio?: StdioOption;
  #EventHandlersCache?: Handlers;
  #CommandHandlersCache?: Handlers;
  #plugin?: string;
  #colorizeLogs: boolean;
  public readonly targetModule: Module;

  private constructor(
    logLevel: LogLevel,
    targetModule: Module,
    prefix: string,
    plugins: Plugins,
    { stdio, colorizeLogs = true }: { stdio?: StdioOption; colorizeLogs?: boolean } = {}
  ) {
    this.#logLevel = logLevel;
    this.targetModule = targetModule;
    this.#plugins = plugins;
    this.#prefix = prefix;
    this.#stdio = stdio;
    this.#colorizeLogs = colorizeLogs;
  }

  private async getIntermodular(pluginName: string): Promise<Intermodular> {
    if (!this.#intermodulars[pluginName]) {
      const logger = getLogger(this.#logLevel, this.pluginNames, this.#prefix, this.#colorizeLogs, pluginName);
      this.#intermodulars[pluginName] = await Intermodular.new({
        source: join(pluginName === "devkeeper" ? __dirname : this.#plugins[pluginName], ".."),
        target: this.targetModule?.cloneWithSharedManager({ logger }),
        logger,
        commandStdio: this.#stdio,
      });
    }
    return this.#intermodulars[pluginName];
  }

  private get pluginNames(): Array<keyof Plugins> {
    return Object.keys(this.#plugins);
  }

  private async getEventHandlers(): Promise<Handlers> {
    if (!this.#EventHandlersCache) this.#EventHandlersCache = await getHandlers(this.#plugins, "event-handlers");
    return this.#EventHandlersCache as Handlers;
  }

  private async getCommandHandler(command: string): Promise<{ pluginName: string; handler: Handler }> {
    if (!this.#CommandHandlersCache) this.#CommandHandlersCache = await getHandlers(this.#plugins, "commands");
    const handlers = this.#CommandHandlersCache?.[command];
    if (handlers === undefined) throw new Error(`Command '${command}' cannot be found. Did you load required plugin?`);
    const pluginName = Object.keys(handlers)[0];
    return { pluginName, handler: handlers[pluginName] };
  }

  /**
   * Eliminates arguments from devkeeper and duplicate created by yargs camel case conversion and
   * returns fkattened array ready to be used with `execa`.
   *
   * @param extra are arguments to be cleaned.
   * @param addDash adds single dash `-` to single character, and double dash `--` to word parameters.
   * @returns flattened array of arguments to be used with execa.
   *
   * @example
   * getExtraArgs({ firstName: "Joe", "first-name": "Joe", devkeeper: {}, "log-level": "info" });
   */
  public cleanArgs(
    extra: Record<string, any>,
    { args = [], exclude = [], addDash = true }: { args?: string[]; exclude?: string[]; addDash?: boolean } = {}
  ): any {
    const builtinExclude = [
      "devkeeper",
      "intermodular",
      "_",
      "log-level",
      "$0",
      "lint-staged",
      ...exclude,
      ...exclude.map((e) => decamelize(e, "-")),
    ];
    const combined: Record<string, any> = { ...(yargsParser as any).Parser(args), ...extra };
    const keysWithDuplicate = Object.keys(combined); // yargs adds camelcase versions too i.e. { firstName: "Jo", firstName: "Jo" }

    const booleanValues = new Set([true, false, "true", "false"]);
    const falseValues = new Set([false, "false"]);

    const result = Object.entries(combined)
      .map(([key, value]) => {
        const decamelized = decamelize(key, "-");
        const keyIndex = keysWithDuplicate.indexOf(key);
        const decamelizedKeyIndex = keysWithDuplicate.indexOf(decamelized);
        return keyIndex > -1 && decamelizedKeyIndex > -1 && keyIndex !== decamelizedKeyIndex && key !== decamelized
          ? [undefined, value]
          : [key, value];
      })
      .filter(([key]) => key !== undefined && !builtinExclude.includes(key) && !builtinExclude.includes(decamelize(key, "-")))
      .map(([key, value]) => {
        if (addDash) return key.length === 1 ? [`-${key}`, value] : [`--${key}`, value];
        return [key, value];
      })
      .flat()
      .filter((value, index, array) => !booleanValues.has(value) && !falseValues.has(array[index + 1]))
      .concat((extra._ || []).slice(1)); // Add positional arguments.
    return result;
  }

  public static async new({
    plugins,
    cwd,
    logLevel = findLogLevel(process.argv) || "info",
    prefix = "devkeeper-plugin-",
    plugin,
    stdio,
    colorizeLogs,
  }: {
    plugins?: Plugins;
    logLevel?: LogLevel;
    cwd?: string;
    prefix?: string;
    plugin?: string;
    stdio?: StdioOption;
    colorizeLogs?: boolean;
  }): Promise<Devkeeper> {
    const targetModule = await Module.new({ cwd, commandStdio: stdio });
    const allPlugins = await getPlugins(targetModule, prefix, { plugins });
    const devkeeper = new Devkeeper(logLevel, targetModule, prefix, allPlugins, { stdio, colorizeLogs });
    const rootIntermodular = await devkeeper.getIntermodular("devkeeper");
    rootIntermodular.log("debug", `Plugins loaded: ${devkeeper.pluginNames.join(", ")}`);
    devkeeper.#plugin = plugin;
    return devkeeper;
  }

  public async runCommand(command: string, args?: Record<string, any>): Promise<any> {
    const { pluginName, handler } = await this.getCommandHandler(command);
    const intermodular = await this.getIntermodular(pluginName);
    return handler({ intermodular, devkeeper: this, ...args });
  }

  public static async run(
    args?: typeof process.argv,
    { plugins, exitProcess = true, cwd, stdio }: { plugins?: Plugins; exitProcess?: boolean; cwd?: string; stdio?: StdioOption } = {}
  ): Promise<any> {
    const devkeeper = await this.new({ plugins, cwd, stdio });

    const middleware: yargs.MiddlewareFunction = (async (argv: Argv, yargsInstance: ExtendedYargs): Promise<void> => {
      const commandPlugin = yargsInstance.commandPlugins?.[argv._[0]];

      if (commandPlugin === undefined) throw new Error(`Cannot determine current plugin. Plugins: ${devkeeper.pluginNames.join(", ")}`);

      devkeeper.#plugin = commandPlugin;
      argv.devkeeper = devkeeper; /* eslint-disable-line no-param-reassign */
      argv.intermodular = await devkeeper.getIntermodular(commandPlugin); /* eslint-disable-line no-param-reassign */
    }) as any;

    const parser: ExtendedYargs = (args ? yargs(args, cwd) : yargs)
      .option("log-level", {
        choices: ["error", "warn", "info", "verbose", "debug", "silly"],
        describe: "Logging level.",
        default: "info",
        global: true,
      })
      .middleware([middleware])
      .recommendCommands()
      .strict()
      .showHelpOnFail(true)
      .demandCommand(1, "")
      .wrap(null)
      .exitProcess(exitProcess);

    const commandPlugins: Record<string, string> = {}; // { commandName-1: pluginName-1, ... }

    Object.entries(devkeeper.#plugins).forEach(([pluginName, srcDir]) => {
      try {
        parser.commandDir(join(srcDir, "commands"), {
          extensions: srcDir.endsWith("/src") ? ["js", "ts"] : ["js"], // For "ts-node", use only "js" to exclude "d.ts from dist dir.
          visit: (commandObject, _, file = "") => {
            const command = commandObject.command || basename(file, extname(file));
            commandPlugins[command] = pluginName;
            return commandObject;
          },
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    });

    parser.commandPlugins = commandPlugins;

    return parser.argv;
  }

  public async doForEachPlugin(fn: (i: Intermodular) => Promise<void>): Promise<any[]> {
    const intermodulars = await Promise.all(this.pluginNames.map((name) => this.getIntermodular(name)));
    return Promise.all(intermodulars.map(fn));
  }

  public async fire(event: string, options: Record<string, any>): Promise<void[]> {
    if (!this.#plugin) throw new Error(`Cannot determine current plugin. Plugins: ${this.pluginNames.join(", ")}`);
    (await this.getIntermodular(this.#plugin)).log("debug", `Event fired: ${event}`);
    const eventHandlers = (await this.getEventHandlers())[event] || {};

    return Promise.all(
      Object.entries(eventHandlers).map(async ([pluginName, handler]) => {
        const intermodular = await this.getIntermodular(pluginName);
        intermodular.log("debug", `Event will be handled: ${event}`);
        await handler({ ...options, intermodular, devkeeper: this }); // `argv` already has `intermodular` and `devkeeper`, override them.
      })
    );
  }
}
