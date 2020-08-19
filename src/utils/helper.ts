import crypto from "crypto";
import fs from "fs";
import mapToObject from "array-map-to-object";
import { DataFile } from "intermodular";

/**
 * Returns MD5-sum of a given file.
 *
 * @param path is the path of the file.
 */
export function md5File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = crypto.createHash("md5");
    const input = fs.createReadStream(path);
    input.on("error", (err) => reject(err));
    output.once("readable", () => resolve(output.read().toString("hex")));
    input.pipe(output);
  });
}

export function getChangedKeyValues(dataFile: DataFile): Record<string, any> {
  const addedKeys = dataFile.getModifiedKeys().set;
  return mapToObject(addedKeys, (key) => [key as string, dataFile.get(key)]);
}
