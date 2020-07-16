import { PluginTestHelper } from "../../src/index";

let helper: PluginTestHelper;

beforeAll(async () => {
  helper = await PluginTestHelper.create("target-module");

  // Create format error for "package.json"
  const pkgContent = await helper.targetModule.readRaw("package.json");
  const unformatPkgContent = pkgContent.replace('"name"', '   "name"');
  await helper.targetModule.write("package.json", unformatPkgContent, { overwrite: true });

  // Create format error for "src/format.css"
  const cssContent = await helper.targetModule.readRaw("src/format.css");
  const unformatCssContent = cssContent.replace("color", "   color");
  await helper.targetModule.write("src/format.css", unformatCssContent, { overwrite: true });
});

describe("prettier", () => {
  it("should detect formatting error.", async () => {
    const { stdout } = await helper.runCommand("format");
    const messageLines = ["package.json", "src/format.css", "Code style issues found in the above file(s)."];
    expect(stdout).toContain(messageLines.join("\n"));
  });
});
