const { execSync } = require('child_process');

const targetPort = Number(process.argv[2] || 3000);

const run = (command) => execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

const killPid = (pid) => {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    console.log(`Freed port ${targetPort} by terminating PID ${pid}`);
  } catch (_) {
    // Ignore kill errors (process may have exited already).
  }
};

const freePortWindows = () => {
  try {
    const output = run(`netstat -ano -p tcp | findstr :${targetPort}`);
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /LISTENING/i.test(line));

    const pids = [...new Set(lines.map((line) => Number(line.split(/\s+/).pop())).filter(Number.isInteger))];
    pids.forEach(killPid);
  } catch (_) {
    // No listener found.
  }
};

const freePortUnix = () => {
  try {
    const output = run(`lsof -ti tcp:${targetPort}`);
    const pids = [...new Set(output.split(/\r?\n/).map((x) => Number(x.trim())).filter(Number.isInteger))];
    pids.forEach(killPid);
  } catch (_) {
    // No listener found.
  }
};

if (process.platform === 'win32') {
  freePortWindows();
} else {
  freePortUnix();
}
