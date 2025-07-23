# Mini-Judge: Lightweight Online Judge System

A secure online judge system for competitive programming competitions. Built using Node.js and Docker.

## 🚀 Features

- **Secure Code Execution**: Run code safely in isolated Docker containers
- **Multiple Languages**: Support for C++ and Python (easily extensible)
- **Queue System**: Handle multiple submissions simultaneously
- **Resource Limits**: Configurable time and memory constraints
- **Easy Problem Creation**: Add new problems with simple file structure

## 🏗️ How It Works

1. **Submit Code**: Upload your solution in C++ or Python
2. **Queue Processing**: Your submission joins the processing queue
3. **Secure Execution**: Code runs in an isolated Docker container
4. **Automatic Testing**: System tests against predefined test cases
5. **Get Results**: Receive verdict (Accepted, Wrong Answer, Time Limit Exceeded, etc.)

## 📦 Quick Start

### Prerequisites
- Node.js 16+
- Docker

### Installation
```bash
# Clone and install
git clone https://github.com/LeGusto/Mini-Judge.git
cd Mini-Judge
npm install

# Start the server
sudo node src/server.js
```

The server will run on `http://localhost:3000`

## 📡 API Usage

### Submit Code
```bash
curl -X POST http://localhost:3000/judge \
  -F "code=@your_solution.cpp" \
  -F "language=cpp" \
  -F "problemID=1"
```

### Check Submission Status
```bash
curl http://localhost:3000/submission/sub_1234567890_1
```

## 🔧 Configuration

### Creating New Problems
Adding new problems is simple! Create a directory in `problems/` with this structure:

```
problems/your_problem/
├── data.json          # Time/memory limits and test count
├── input/             # Test input files (1.in, 2.in, etc.)
├── output/            # Expected output files (1.out, 2.out, etc.)
└── sol.cpp           # Sample solution (optional)
```

### Example Problem Setup
```json
// problems/1/data.json
{
  "time_limit": "2",
  "memory_limit": "256",
  "tests": "14"
}
```

### Test Files
- **Input files**: `input/1.in`, `input/2.in`, etc.
- **Output files**: `output/1.out`, `output/2.out`, etc.
- **File format**: Plain text files
- **Naming**: Must match exactly (1.in → 1.out)

## 🔒 Security

- **Container Isolation**: Each submission runs in its own Docker container
- **Resource Limits**: Strict CPU and memory constraints
- **Network Isolation**: No network access during execution
- **Auto-cleanup**: Containers automatically removed after execution

## 🛠️ Adding New Languages

To add support for a new language, update the `LANGUAGE_CONFIG` in `src/judge.js`:

```javascript
javascript: {
  image: "node:18-slim",
  cmd: (codeFileName, inputFileName) =>
    inputFileName
      ? ["bash", "-c", `node ${codeFileName} < ${inputFileName}`]
      : ["node", codeFileName],
}
```
