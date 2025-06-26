const express = require("express");
const { executeCode } = require("./judge");
const { getVerdict } = require("./verdict");

const app = express();
app.use(express.json());

app.post("/judge", async (req, res) => {
  const { code, language, input, expectedOutput } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  try {
    const result = await executeCode(code, language, input);
    const verdict = getVerdict(result, expectedOutput);

    res.json({
      output: result.output,
      error: result.error,
      time: result.time,
      memory: result.memory,
      verdict: verdict,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
