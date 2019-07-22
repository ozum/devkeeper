import Intermodular from "intermodular";
import merge from "lodash.merge";
import differenceWith from "lodash.differencewith";
import isEqual from "lodash.isequal";
import DataFile from "intermodular/dist/data-file";
import * as nunjucks from "nunjucks";
import * as path from "path";
import { mergeArrayUnique } from "./utils";

interface Modifications {
  /**
   * Version of the module which made modifications.
   */
  version: string;
  /**
   * Files added to target module physically.
   */
  files: string[];
  /**
   * Keys added to `package.json`
   */
  objectKeys: any[];
  /**
   * Keys and elements added to arrays in `package.json`
   * @example
   * // For example, assume "new-file" is added `files` key of package.json as below:
   * {
   *   files: ["existing-file", "new-file"]
   * }
   * // It is possible to retrieve added values from
   * {
   *   objectKeys: {...}
   *   arrayKeys: { files: ["new-file"] }
   * }
   */
  arrayKeys: Record<string, any[]>;
}

interface ModifyCondition {
  /**
   * Allows modification if only `path` exists.
   */
  ifNotExists?: boolean;
  /**
   * Allows modification if only `path` does not exists.
   */
  ifExists?: boolean;
  /**
   * Allows modification if only value stored at `path` equals/deeply equals to it's value.
   */
  ifEqual?: any;
  /**
   * Allows modification if only value stored at `path` equals/deeply equals to it's value.
   */
  ifNotEqual?: any;
}

export default class PackageUtil {
  private intermodular: Intermodular;
  private sourcePackage: DataFile;
  private targetPackage: DataFile;

  public constructor(intermodular: Intermodular) {
    this.intermodular = intermodular;
    this.sourcePackage = this.intermodular.sourceModule.getDataFileSync("package.json");
    this.targetPackage = this.intermodular.targetModule.getDataFileSync("package.json");
  }

  /**
   * Object of `package.json` key conditions. Keys are ordered.
   */
  private get keyConditions(): Record<string, ModifyCondition> {
    return {
      name: {},
      label: { ifNotExists: true },
      version: {},
      description: {},
      keywords: { ifNotExists: true },
      engines: {},
      main: {},
      types: {},
      files: {},
      bin: {},
      homepage: { ifNotExists: true },
      bugs: { ifNotExists: true },
      repository: { ifNotExists: true },
      author: { ifNotExists: true },
      license: { ifNotExists: true },
      scripts: {},
      shields: {},
      identities: {},
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
      [this.intermodular.targetModule.nameWithoutUser]: {},
    };
  }

  /**
   * Key name to store modifications in `package.json`
   */
  private get modificationsKey(): string {
    return `${this.intermodular.sourceModule.nameWithoutUser}Modifications`;
  }

  /**
   * Modifications stored in `package.json`. If it does not exists, it is created with empty values.
   */
  public get modifications(): Modifications {
    if (!this.targetPackage.has(this.modificationsKey)) {
      this.targetPackage.set(this.modificationsKey, {
        files: [],
        objectKeys: [],
        arrayKeys: {},
      });
    }
    return this.targetPackage.get(this.modificationsKey);
  }

  /**
   * Adds given modification under `[module name]Modifications` key in given `package.json`. `key` must have an object value.
   *
   * @param key is name of the key to add modifications. Must have an object value.
   * @param newValues are values to add modifications.
   */
  private addObjectModification(key: "files" | "objectKeys", newValues: string[]): void {
    const originalValues = this.modifications[key];
    const mergedValues = mergeArrayUnique(originalValues, newValues);
    this.modifications[key] = mergedValues;
  }

  /**
   * Adds given modification under `[module name]Modifications` key in given `package.json`. `key` must have an array value.
   *
   * @param key is name of the key to add modifications. Must have an array value.
   * @param newValues are values to add modifications.
   */
  private addArrayModification(key: string, newValues: any[]): void {
    const originalValues = this.modifications.arrayKeys[key];
    const mergedValues = mergeArrayUnique(originalValues, newValues);
    this.modifications.arrayKeys[key] = mergedValues;
  }

  /**
   * Removes previously added elements from given `key` in `package.json`. Key must have an array value.
   *
   * @param key is the key to remove elements from it's value.
   */
  private removeAddedArrayElements(key: string): void {
    const allValues = this.targetPackage.get(key);
    const addedValues = this.modifications.arrayKeys[key];
    const originalValues = differenceWith(allValues, addedValues);
    this.targetPackage.set(key, originalValues);
  }

  /**
   * List of dependencies and devDependency packages added to target file.
   */
  public get addedDependencies(): string[] {
    return this.targetPackage
      .getModifiedKeys({ include: ["devDependencies", "dependencies"] })
      .set.map(dep => dep.replace("devDependencies.", "").replace("dependencies.", ""));
  }

  /**
   * Adds given values to `key` of `package.json`. Key must be an array or should not exists.
   * Also adds new additions to modifications.
   *
   * @param key is the key to add values to.
   * @param values are list of files to add.
   */
  private addToArray(key: string, values: any[]): void {
    const existingValues = this.targetPackage.get(key) || [];
    if (!Array.isArray(existingValues)) {
      throw new Error(`${key} must be an array.`);
    }
    const addedValues = differenceWith(values, existingValues, isEqual);
    this.targetPackage.set(key, [...addedValues, ...existingValues]);
    this.addArrayModification(key, addedValues);
  }

  /**
   * Reads `package.json` nunjucks template in given feature dir, renders and parses it.
   *
   * @param feature is feature name which `package.json` belongs to.
   * @returns JSON data of `package.json` for given feature.
   */
  private getPackageJson(feature: string): Record<string, any> {
    const content = nunjucks.render(path.join(__dirname, "../module-files/package-json", feature, "package.json"), {
      intermodular: this.intermodular,
      path,
    });
    return JSON.parse(content);
  }

  /**
   * Updates data of target `package.json`
   *
   * @param data is data to add `package.json`.
   * @param addDevDependencies is whether to add `devDependencies` to target `package.json`.
   */
  private updateKeys(data: Record<string, any>, { addDependencies }: { addDependencies?: boolean }): void {
    const otherKeys = differenceWith(Object.keys(data), ["scripts", "files", "dependencies", "devDependencies"]);
    const { keyConditions } = this;

    otherKeys.forEach(key => {
      this.targetPackage.set(key, data[key], keyConditions[key] || {});
    });

    this.targetPackage.assign("scripts", data.scripts);

    if (this.sourcePackage.get("name") === this.targetPackage.get("name")) {
      this.targetPackage.assign("dependencies", data.dependencies || {});
      this.targetPackage.assign("dependencies", data.devDependencies || {}); // If updating itself add dev dependencies to dependencies.
    } else if (addDependencies) {
      this.targetPackage.assign("dependencies", data.dependencies || {});
      this.targetPackage.assign("devDependencies", data.devDependencies || {});
    }

    this.addToArray("files", data.files);
  }

  /**
   * Updates target `package.json` file.
   *
   * @param addDevDependencies is whether to add `devDependencies` to target `package.json`.
   * @param files are array of added files relative to target root which would be added to modifications.
   * @param features are list of features to be added to `package.json` file.
   */
  public update(
    { addDependencies, files = [], features = [] }: { addDependencies?: boolean; files?: string[]; features?: string[] } = {} as any
  ): void {
    // Add feature specific tasks such as `microbundle`, `vuepress` etc.
    const featuredPackagesData = features.map(feature => this.getPackageJson(feature));
    const newKeys = merge({}, ...featuredPackagesData);
    this.updateKeys(newKeys, { addDependencies });

    // Add modifications to `package.json`.
    const excludedFromModificationKeys = Object.keys(this.keyConditions).filter(key => this.keyConditions[key].ifNotExists);
    const modifiedKeys = this.targetPackage.getModifiedKeys({
      exclude: ["files", this.modificationsKey, ...excludedFromModificationKeys],
    }).set;

    this.addObjectModification("files", files);
    this.addObjectModification("objectKeys", modifiedKeys);
    this.modifications.version = this.sourcePackage.get("version");

    // Order keys and save
    this.targetPackage.orderKeys(Object.keys(this.keyConditions));
    this.targetPackage.orderKeysOf("scripts");
    this.targetPackage.orderKeysOf("devDependencies");
  }

  /**
   * Uninstalls updates made previously.
   */
  public uninstall(): void {
    // Remove object keys and array keys from `package.json`.
    this.modifications.objectKeys.forEach(key => this.targetPackage.delete(key));
    Object.keys(this.modifications.arrayKeys).forEach(key => this.removeAddedArrayElements(key));

    this.targetPackage.delete(this.modificationsKey);
  }
}
