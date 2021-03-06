import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");
});

describe("update", () => {
  it("should update module.", async () => {
    await helper.runCommand("keep");
    expect(helper.targetModule.package.get("scripts.test")).toBe("devkeeper test");
  });
});
