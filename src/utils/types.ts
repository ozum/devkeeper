import type Intermodular from "intermodular";
import Devkeeper from "../devkeeper";

type PluginName = string;
type HandlerName = string;
type HandlerDirectory = string;

/** Command or event handler arguments. */
export type HandlerArgs = { intermodular: Intermodular; devkeeper: Devkeeper; exitOnProcessFailure?: boolean; [key: string]: any };

/** Command or event handler signature. */
export type Handler = (args: HandlerArgs) => Promise<void>;

/** Type for storing handler functions added by given name. For example more than one plugin may add `update` event handler. */
export type Handlers = Record<HandlerName, Record<PluginName, Handler>>;

/** Type for stroing plugins and their directories holding `commands` and `events-handler` directories. Usually `src` or `dist`. */
export type Plugins = Record<PluginName, HandlerDirectory>;
