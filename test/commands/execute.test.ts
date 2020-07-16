import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");
});

describe("readme", () => {
  it("should execute file without positional arguments.", async () => {
    const { stdout } = await helper.runCommand("execute", { watch: false });
    expect(stdout).toContain("Usage: ts-node-dev");
  });

  it("should execute file with positional arguments.", async () => {
    const { stdout } = await helper.runCommand("execute", { watch: false, _: ["", "src/console.ts"] });
    expect(stdout).toContain("Some output");
  });
});
