import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");

  // Create format error.
  const content = await helper.targetModule.readRaw("package.json");
  const unformatContent = content.replace('"name"', ' "name"');
  await helper.targetModule.write("package.json", unformatContent, { overwrite: true });
});

describe("prettier", () => {
  it("should detect formatting error.", async () => {
    const { stdout } = await helper.runCommand("format");
    expect(stdout).toContain("package.json\nCode style issues found in the above file(s)");
  });
});
