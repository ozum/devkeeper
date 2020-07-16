import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");

  // Create lint error.
  const content = await helper.targetModule.readRaw("src/address.ts");
  const unlintContent = content.replace("export default class", " export default class");
  await helper.targetModule.write("src/address.ts", unlintContent, { overwrite: true });
});

describe("lint", () => {
  it("should detect lint error.", async () => {
    const { stdout } = await helper.runCommand("lint");
    expect(stdout).toContain("error  Delete `·`  prettier/prettier");
  }, 10000);
});
