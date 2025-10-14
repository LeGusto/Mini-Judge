# Mini-Judge

A lightweight code judge for competitive programming. Runs code submissions in isolated Docker containers and returns verdicts. Built with Node.js + Docker.

Used by [Mini-Competition](https://github.com/LeGusto/Comp-Prog-Site) for contest judging.

## What It Does

Accepts code submissions via REST API, executes them in Docker containers with resource limits, compares output against test cases, and returns verdicts (AC, WA, TLE, RTE, etc.).

**Features:**
- Isolated Docker execution for security
- C++ and Python support (extensible to other languages)
- Configurable time and memory limits
- Queue system for handling concurrent submissions
- Custom checkers for special output validation
- Automatic container cleanup

## How It Works

1. Receive code via POST request
2. Add submission to processing queue
3. Spin up isolated Docker container
4. Run code against test cases with resource limits
5. Compare output (exact match or custom checker)
6. Return verdict with execution stats
7. Clean up container

## Quick Start

**Requirements:** Node.js 18+, Docker

```bash
git clone https://github.com/LeGusto/Mini-Judge.git
cd Mini-Judge
npm install
sudo node src/server.js
```

Server runs on `http://localhost:3000`

## API

### Submit Code
```bash
POST /judge
```

Form data:
- `code` - source code file
- `language` - `cpp` or `python`
- `problemID` - problem identifier
- `callback` - optional callback URL for async results

Example:
```bash
curl -X POST http://localhost:3000/judge \
  -F "code=@solution.cpp" \
  -F "language=cpp" \
  -F "problemID=1"
```

Response:
```json
{
  "submissionID": "sub_1234567890_1",
  "status": "queued"
}
```

### Check Status
```bash
GET /submission/:submissionID
```

Response:
```json
{
  "verdict": "AC",
  "time": 142,
  "memory": 2048,
  "testsPassed": 14,
  "totalTests": 14
}
```

### Health Check
```bash
GET /health
```

## Adding Problems

Create a directory in `problems/` with this structure:

```
problems/your_problem_id/
├── data.json         # Required: limits and test count
├── output/           # Required: expected outputs
│   ├── 1.out
│   ├── 2.out
│   └── ...
├── input/            # Optional: test inputs
│   ├── 1.in
│   └── 2.in
├── checker.js        # Optional: custom validator
└── sol.cpp           # Optional: reference solution
```

**data.json:**
```json
{
  "time_limit": "2",
  "memory_limit": "256",
  "tests": "14"
}
```

- Time limit in seconds
- Memory limit in MB
- Tests: number of test cases

**Test files:**
- Must be numbered sequentially (1.in/1.out, 2.in/2.out, etc.)
- Input files are optional (for problems without input)
- Output files are required

**Custom checker (optional):**
```javascript
module.exports = (input, expectedOutput, userOutput) => {
  // Return true if correct, false otherwise
  // Useful for problems with multiple valid answers
};
```

## Adding Languages

Edit `src/judge.js` and add to `LANGUAGE_CONFIG`:

```javascript
java: {
  image: "openjdk:17-slim",
  cmd: (codeFileName, inputFileName) => 
    inputFileName
      ? ["bash", "-c", `java ${codeFileName} < ${inputFileName}`]
      : ["java", codeFileName],
  extension: "java"
}
```

## Architecture

```
src/
├── server.js         # Express server and routes
├── judge.js          # Core judging logic
├── queue_manager.js  # Submission queue handling
├── validation.js     # Input validation
├── verdict.js        # Verdict types and formatting
├── middleware.js     # Request middleware
└── fileUtils.js      # File operations
```

**Flow:**
1. `server.js` receives submission
2. `validation.js` validates input
3. `queue_manager.js` queues submission
4. `judge.js` executes in Docker
5. Results stored and returned

## Configuration

Edit `config.js`:

```javascript
{
  QUEUE_SIZE: 100,           // Max queued submissions
  TIMEOUT: 30000,            // Max execution time (ms)
  DOCKER_TIMEOUT: 35000,     // Docker container timeout
  CLEANUP_INTERVAL: 60000    // Cleanup interval
}
```

## Security

- Each submission runs in an isolated Docker container
- No network access during execution
- Resource limits enforced (CPU, memory, time)
- Containers destroyed after execution
- No access to host filesystem
- Code runs as unprivileged user

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

## Known Issues

- Requires sudo for Docker access (security consideration)
- No submission rate limiting yet
- Queue can overflow with too many submissions
- Memory measurement uses baseline subtraction (container overhead at startup is subtracted from peak memory)
- No support for interactive problems

## Future Improvements

- Rate limiting per IP/user
- Better error messages for compilation failures
- Support for more languages (Java, Rust, Go)
- Interactive problem support
- Batch testing mode
- Persistent submission history
- Admin dashboard for monitoring

## Development

**Project uses:**
- Express 5 for routing
- Dockerode for Docker API
- Zod for validation
- Jest for testing
- Multer for file uploads

**Running in dev:**
```bash
npm run dev
```

**Adding tests:**
Put test cases in `tests/code/[language]/test_name/` with `main.[ext]` and `output.txt`
