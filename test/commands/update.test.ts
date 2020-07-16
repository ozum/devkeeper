import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");
});

describe("update", () => {
  it("should update module.", async () => {
    await helper.runCommand("update");
    expect(helper.targetModule.package.get("scripts.keep")).toBe("devkeeper update");
  });
});
