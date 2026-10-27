import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Drive native DOM, CSS, events and observers without a browser-test dependency.
export async function startBrowser() {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><meta charset="utf-8"><title>Fixture</title><body></body>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(join(tmpdir(), 'no-more-scroll-test-'));
  const args = [
    '--headless', '--disable-dev-shm-usage', '--disable-background-networking',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ];
  if (process.env.CHROMIUM_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  const processHandle = spawn(process.env.CHROMIUM_PATH || 'chromium', args);
  let socket;
  const close = async () => {
    socket?.close();
    if (processHandle.pid && processHandle.exitCode === null && processHandle.signalCode === null) {
      const exited = once(processHandle, 'exit');
      const timer = setTimeout(() => processHandle.kill('SIGKILL'), 2000);
      processHandle.kill('SIGTERM');
      await exited;
      clearTimeout(timer);
    }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('Chromium startup timed out: ' + output)), 10000);
      processHandle.once('error', error => { clearTimeout(timer); reject(error); });
      processHandle.once('exit', () => { clearTimeout(timer); reject(Error('Chromium exited: ' + output)); });
      processHandle.stderr.on('data', chunk => {
        output = (output + chunk).slice(-8000);
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await once(socket, 'open');
    let id = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(Error('DevTools command timed out: ' + method));
      }, 10000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async expression => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await delay(30);
      }
      throw Error('Condition did not become true: ' + expression);
    };
    await call('Page.enable');
    return {
      evaluate, waitFor, close,
      async navigate(path) {
        await call('Page.navigate', { url: origin + path });
        await waitFor(`document.readyState === 'complete' && location.href === ${JSON.stringify(origin + path)}`);
        // Each scenario gets a fresh page and independent redirect cooldown.
        await evaluate('sessionStorage.clear()');
      }
    };
  } catch (error) {
    await close();
    throw error;
  }
}
