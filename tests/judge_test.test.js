const { executeCode } = require("../src/judge");

describe("executeCode", () => {
  it("should execute Python code and return the correct output", async () => {
    const code = 'print("Hello, World!")';
    const language = "python";
    const input = "";
    const problemId = null;
    const result = await executeCode({ code, language, input, problemId });
    expect(result.output).toBe("Hello, World!");
  }, 20000);

  it("should execute Python code and return the correct output", async () => {
    const code = "print('i' * 1000)";
    const language = "python";
    const input = "";
    const problemId = null;
    const result = await executeCode({ code, language, input, problemId });
    // Clean the output to remove non-ASCII characters and trim whitespace
    const cleanOutput = result.output.replace(/[^\x20-\x7E]+/g, "").trim();
    expect(cleanOutput).toBe("i".repeat(1000));
  }, 20000);

  it("should throw an error for unsupported languages", async () => {
    const code = 'console.log("Hello, World!")';
    const language = "javascript";
    const input = "";
    const problemId = null;
    await expect(
      executeCode({ code, language, input, problemId })
    ).rejects.toThrow("Unsupported language");
  });
});
