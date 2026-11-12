// Hot Reload browser tools client.
//
// This module is part of the application build output. It must never be downloaded from the
// Hot Reload provider: the provider is the party this client authenticates, so executable code
// served by it could not be trusted. The generated configuration module pins the provider's public
// key at build time and passes it to startBrowserTools.

const hotReloadActiveKey = '_dotnet_watch_hot_reload_active';
// Ensures we only connect once even when several activation paths import this module.
const scriptInjectedSentinel = '_dotnet_watch_ws_injected';
const replayResponseLoggingLevel = 1;
const AgentMessageSeverity_Warning = 1;
const AgentMessageSeverity_Error = 2;
// Bounds how long the replay waits for the Hot Reload agent. Only spent when there is something to
// replay and the apply API is still missing, which is the case that would otherwise lose updates.
const hotReloadAgentReadyTimeoutMs = 10000;
const browserToolsStyles = `
  :host {
    z-index: 1000000;
    position: fixed;
  }

  :host(#dotnet-compile-error) {
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: black;
    overflow: scroll;
  }

  .dotnet-compile-error-item {
    border: 2px solid red;
    padding: 8px;
    background-color: #faa;
  }

  .dotnet-compile-error-message {
    font-weight: bold;
  }

  :host(#dotnet-hotreload-toast) {
    width: 48px;
    height: 48px;
    top: 5px;
    left: 5px;
  }

  svg {
    filter: drop-shadow(0 2px 1px rgb(0 0 0 / 0.4));
  }

  #hotreloaded-ellipse1 {
    animation: hotreloaded-ellipse1_c_o 1800ms linear 1 normal forwards;
  }

  #hotreloaded-path1 {
    animation-name: hotreloaded-path1__m, hotreloaded-path1_c_o;
    animation-duration: 1800ms;
    animation-delay: 100ms;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
    animation-direction: normal;
    animation-iteration-count: 1;
  }

  @keyframes hotreloaded-ellipse1_c_o {
    0% { opacity: 0; }
    16.666667% { opacity: 1; }
    72.222222% { opacity: 1; }
    90% { opacity: 0; }
    100% { opacity: 0; }
  }

  @keyframes hotreloaded-path1__m {
    0% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
    16.666667% { d: path('M126.151214,288.396852L126.151214,288.396852L126.151214,288.396852'); }
    22.222222% {
      d: path('M126.151214,288.396852L196.625037,350.661591L196.625037,350.661591');
      animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
    }
    33.333333% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
    100% { d: path('M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242'); }
  }

  @keyframes hotreloaded-path1_c_o {
    0% { opacity: 0; }
    16.666667% { opacity: 0; }
    22.222222% { opacity: 1; }
    72.222222% { opacity: 1; }
    90% { opacity: 0; }
    100% { opacity: 0; }
  }
`;
let browserToolsStylesheet;

/**
 * Connects to the Hot Reload browser tools provider.
 *
 * @param {object} config Build-generated configuration.
 * @param {string} config.publicKey Base64 SubjectPublicKeyInfo of the provider's session key.
 * @param {string} config.connectPath Root-relative route of the provider's WebSocket endpoint.
 * @param {string} config.clearCachePath Root-relative route of the provider's cache reset endpoint.
 * @param {string} config.moduleUrl URL of the generated configuration module. Polled to detect that
 *                                  the application is reachable again after it restarted.
 */
export async function startBrowserTools(config) {
  if (window.hasOwnProperty(scriptInjectedSentinel)) {
    return;
  }
  window[scriptInjectedSentinel] = true;

  const { publicKey, connectPath, clearCachePath, moduleUrl } = config;

  const sharedSecret = await getSecret(publicKey);
  if (!sharedSecret) {
    delete window[scriptInjectedSentinel];
    console.debug('Unable to protect the Hot Reload browser tools connection. Browser tools are disabled.');
    return;
  }

  const connectUrl = new URL(connectPath, document.baseURI);
  connectUrl.protocol = connectUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  let closing = false;
  let waiting = false;

  // The provider sends the session initialization message, which carries the updates produced
  // before this browser connected, as the first message on the socket. It releases live messages
  // for this connection only after the browser acknowledges that message, so chaining the live
  // message queue on the initialization promise preserves the order even if a live message somehow
  // arrives early.
  let completeInitialization;
  let failInitialization;
  const initialized = new Promise((resolve, reject) => { completeInitialization = resolve; failInitialization = reject; });
  initialized.catch(() => { });

  let initializationMessageReceived = false;
  let receiveInitializationMessage;
  const initializationMessage = new Promise(resolve => receiveInitializationMessage = resolve);
  let messageQueue = initialized;

  let connection;
  try {
    connection = await getWebSocket(connectUrl, sharedSecret.encryptedSharedSecret, message => {
      if (!initializationMessageReceived) {
        initializationMessageReceived = true;
        receiveInitializationMessage(message);
      } else {
        messageQueue = messageQueue
          .then(() => handleMessage(message))
          .catch(error => console.debug('Failed to process a browser refresh message.', error));
      }
    });
  } catch (ex) {
    console.debug(ex);
  }

  if (!connection) {
    delete window[scriptInjectedSentinel];
    console.debug('Unable to establish a connection to the browser refresh server.');
    return;
  }

  connection.onerror = function (event) { console.debug('Hot Reload socket error.', event) }
  connection.onclose = function () {
    delete window[scriptInjectedSentinel];
    failInitialization('The browser tools connection was closed.');
    console.debug('Hot Reload socket closed.');
    if (!closing) {
      // The browser reaches the provider through the application, so the socket dies when the
      // application restarts and any pending Reload message is lost. Reload once it is back.
      reloadWhenApplicationReturns();
    }
  }

  if (await initializeSession()) {
    completeInitialization();

    const agent = hotReloadAgentSignal();
    agent.ready.then(() => {
      const updates = agent.pendingUpdates;
      delete agent.pendingUpdates;
      if (!updates) {
        return;
      }

      if (updates.length && !hasDeltaApplyApi()) {
        console.error('Unable to apply deferred Hot Reload updates because the WebAssembly Hot Reload agent is unavailable.');
        return;
      }

      for (const update of updates) {
        try {
          const log = applyDeltas(update.deltas, update.responseLoggingLevel);
          for (const entry of log) {
            if (entry.severity === AgentMessageSeverity_Error) {
              console.error(entry.message);
            } else if (entry.severity === AgentMessageSeverity_Warning) {
              console.warn(entry.message);
            } else {
              console.debug(entry.message);
            }
          }
        } catch (error) {
          console.error('Unable to apply deferred Hot Reload updates.', error);
        }
      }
    });
  } else {
    closing = true;
    connection.close();
  }

  async function initializeSession() {
    let payload;
    try {
      payload = JSON.parse((await withTimeout(initializationMessage, 30000)).data);
    } catch (error) {
      console.debug('Unable to initialize the browser tools session.', error);
      return false;
    }

    if (payload.type !== 'InitializeSession') {
      console.error(`Expected the browser tools session initialization message but received '${payload.type}'.`);
      return false;
    }

    if (!authenticateProvider(payload.sharedSecret)) {
      console.error('Unable to validate the browser refresh server. Closing the connection.');
      return false;
    }

    const log = [];
    let applyError;
    try {
      const updates = payload.updates ?? [];
      if (updates.length && !hotReloadAgentSignal().pendingUpdates && !(await waitForDeltaApplyApi())) {
        // Keep initializing: the connection is still useful for reloads, diagnostics and CSS, and
        // failing here would close the socket and reload the page into the same state. Surface the
        // condition in the Hot Reload console instead.
        log.push({
          "message": 'The Hot Reload agent did not become available in time, so the updates produced before this browser connected were not applied.',
          "severity": AgentMessageSeverity_Warning
        });
      }

      for (const update of updates) {
        try {
          const entries = applyDeltas(update.deltas, replayResponseLoggingLevel);
          if (entries && entries.length) {
            log.push(...entries);
          }
        } catch (error) {
          // Report the failure without failing the initialization, for the same reason as above:
          // Hot Reload prints these entries as errors, while closing the socket would only make
          // the page reload into a browser that cannot apply updates either.
          console.warn('Unable to replay Hot Reload updates.', error);
          log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
        }
      }
    } catch (error) {
      console.warn('Unable to initialize the browser tools session.', error);
      applyError = error;
      log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
    }

    connection.send(JSON.stringify({ "success": !applyError, "log": log }));
    return !applyError;
  }

  async function handleMessage(message) {
    const payload = JSON.parse(message.data);
    const action = {
      'Reload': () => reload(),
      'Wait': () => wait(),
      'UpdateStaticFile': () => updateStaticFile(payload.path),
      'ApplyManagedCodeUpdates': () => applyManagedCodeUpdates(payload.sharedSecret, payload.deltas, payload.responseLoggingLevel),
      'ReportDiagnostics': () => reportDiagnostics(payload.diagnostics),
      'RefreshBrowser': () => refreshBrowser()
    };

    if (payload.type && action.hasOwnProperty(payload.type)) {
      await action[payload.type]();
    } else {
      console.error('Unknown payload:', message.data);
    }
  }

  // The provider proves it decrypted the secret this browser generated, which is only possible for
  // the process holding the private key matching the build-pinned public key.
  function authenticateProvider(providerSecret) {
    return providerSecret === sharedSecret.encodedSharedSecret;
  }

  async function reloadWhenApplicationReturns() {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const response = await fetch(moduleUrl, { cache: 'no-store' });
        if (response.ok) {
          location.reload();
          return;
        }
      } catch (error) {
        // The application is still restarting.
      }
    }
  }

  function updateStaticFile(path) {
    if (path && path.endsWith('.css')) {
      updateCssByPath(path);
    } else {
      console.debug(`File change detected to file ${path}. Reloading page...`);
      location.reload();
      return;
    }
  }

  async function updateCssByPath(path) {
    const styleElement = document.querySelector(`link[href^="${path}"]`) ||
      document.querySelector(`link[href^="${document.baseURI}${path}"]`);

    // Receive a Clear-site-data header.
    await fetch(new URL(clearCachePath, document.baseURI), { cache: 'no-store' });

    if (!styleElement || !styleElement.parentNode) {
      console.debug('Unable to find a stylesheet to update. Updating all local css files.');
      updateAllLocalCss();
    }

    updateCssElement(styleElement);
  }

  function updateAllLocalCss() {
    [...document.querySelectorAll('link')]
      .filter(l => l.baseURI === document.baseURI)
      .forEach(e => updateCssElement(e));
  }

  function updateCssElement(styleElement) {
    if (!styleElement || styleElement.loading) {
      // A file change notification may be triggered for the same file before the browser
      // finishes processing a previous update. In this case, it's easiest to ignore later updates
      return;
    }

    const newElement = styleElement.cloneNode();
    const href = styleElement.href;
    newElement.href = href.split('?', 1)[0] + `?nonce=${Date.now()}`;

    styleElement.loading = true;
    newElement.loading = true;
    newElement.addEventListener('load', function () {
      newElement.loading = false;
      styleElement.remove();
    });

    styleElement.parentNode.insertBefore(newElement, styleElement.nextSibling);
  }

  function applyDeltas_legacy(deltas) {
    let apply = window.Blazor?._internal?.applyHotReload

    // Only apply hot reload deltas if Blazor has been initialized.
    // It's possible for Blazor to start after the initial page load, so we don't consider skipping this step
    // to be a failure. These deltas will get applied later, when Blazor completes initialization.
    if (apply) {
      deltas.forEach(d => {
        if (apply.length == 5) {
          // WASM 8.0
          apply(d.moduleId, d.metadataDelta, d.ilDelta, d.pdbDelta, d.updatedTypes)
        } else {
          // WASM 9.0
          apply(d.moduleId, d.metadataDelta, d.ilDelta, d.pdbDelta)
        }
      });
    }
  }

  function applyDeltas(deltas, responseLoggingLevel) {
    const agent = hotReloadAgentSignal();
    if (agent.pendingUpdates) {
      agent.pendingUpdates.push({ deltas, responseLoggingLevel });
      console.debug('Managed code updates deferred until WebAssembly starts.');
      return [];
    }

    let applyDeltas = agent.applyHotReloadDeltas ?? window.Blazor?._internal?.applyHotReloadDeltas
    if (applyDeltas) {
      // Only apply hot reload deltas if Blazor has been initialized.
      // It's possible for Blazor to start after the initial page load, so we don't consider skipping this step
      // to be a failure. These deltas will get applied later, when Blazor completes initialization.

      let wasmDeltas = deltas.map(delta => {
        return {
          "moduleId": delta.moduleId,
          "metadataDelta": delta.metadataDelta,
          "ilDelta": delta.ilDelta,
          "pdbDelta": delta.pdbDelta,
          "updatedTypes": delta.updatedTypes,
        };
      });

      return applyDeltas(wasmDeltas, responseLoggingLevel);
    }

    // Try invoke older WASM API:
    applyDeltas_legacy(deltas)
    return [];
  }

  function applyManagedCodeUpdates(providerSecret, deltas, responseLoggingLevel) {
    if (!authenticateProvider(providerSecret)) {
      throw 'Unable to validate the server. Rejecting apply-update payload.';
    }

    console.debug('Applying managed code updates.');

    let applyError = undefined;
    let log = [];
    try {
      log = applyDeltas(deltas, responseLoggingLevel);
    } catch (error) {
      console.warn(error);
      applyError = error;
      log.push({ "message": getMessageAndStack(error), "severity": AgentMessageSeverity_Error });
    }

    connection.send(JSON.stringify({
      "success": !applyError,
      "log": log
    }));

    if (!applyError) {
      displayChangesAppliedToast();
    }
  }

  function reportDiagnostics(diagnostics) {
    console.debug('Reporting Hot Reload diagnostics.');

    document.querySelectorAll('#dotnet-compile-error').forEach(el => el.remove());

    if (diagnostics.length == 0) {
      return;
    }

    const { host: el, root } = createBrowserToolsHost('dotnet-compile-error');
    document.body.appendChild(el);
    diagnostics.forEach(error => {
      const item = root.appendChild(document.createElement('div'));
      item.className = 'dotnet-compile-error-item';
      const message = item.appendChild(document.createElement('div'));
      message.className = 'dotnet-compile-error-message';
      message.textContent = error.Message;
      item.appendChild(document.createElement('div')).textContent = error;
    });
  }

  function displayChangesAppliedToast() {
    document.querySelectorAll('#dotnet-compile-error').forEach(el => el.remove());
    if (document.querySelector('#dotnet-hotreload-toast')) {
      return;
    }
    if (!window[hotReloadActiveKey])
    {
        return;
    }
    const { host: el, root } = createBrowserToolsHost('dotnet-hotreload-toast');
    root.appendChild(createHotReloadToastIcon());
    document.body.appendChild(el);
    window[hotReloadActiveKey] = false;
    setTimeout(() => el.remove(), 2000);
  }

  function createHotReloadToastIcon() {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 500 500');

    const ellipse = svg.appendChild(document.createElementNS(svgNamespace, 'ellipse'));
    ellipse.id = 'hotreloaded-ellipse1';
    ellipse.setAttribute('rx', '212.808853');
    ellipse.setAttribute('ry', '205.404598');
    ellipse.setAttribute('transform', 'matrix(0.982102 0 0 1.017504 251 238)');
    ellipse.setAttribute('opacity', '0');
    ellipse.setAttribute('fill', 'rgb(120,120,120)');

    const path = svg.appendChild(document.createElementNS(svgNamespace, 'path'));
    path.id = 'hotreloaded-path1';
    path.setAttribute('d', 'M126.151214,288.396852L196.625037,350.661591L320.793323,178.518242');
    path.setAttribute('transform', 'matrix(1 0 0 1 27.527732 -26.589916)');
    path.setAttribute('opacity', '0');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgb(255,255,255)');
    path.setAttribute('stroke-width', '40');
    path.setAttribute('stroke-linecap', 'round');
    return svg;
  }

  function createBrowserToolsHost(id) {
    const host = document.createElement('div');
    host.id = id;
    const root = host.attachShadow({ mode: 'open' });
    if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
      if (!browserToolsStylesheet) {
        browserToolsStylesheet = new CSSStyleSheet();
        browserToolsStylesheet.replaceSync(browserToolsStyles);
      }

      root.adoptedStyleSheets = [browserToolsStylesheet];
    }

    return { host, root };
  }

  function refreshBrowser() {
    if (window.Blazor) {
      window[hotReloadActiveKey] = true;
      // hotReloadApplied triggers an enhanced navigation to
      // refresh pages that have been statically rendered with
      // Blazor SSR.
      if (window.Blazor?._internal?.hotReloadApplied)
      {
        console.debug('Refreshing browser: WASM.');
        Blazor._internal.hotReloadApplied();
      }
      else
      {
        console.debug('Refreshing browser.');
        displayChangesAppliedToast();
      }
    } else {
      console.debug('Refreshing browser: Reloading.');
      location.reload();
    }
  }

  function reload() {
    console.debug('Reloading.');
    location.reload();
  }

  function wait() {
    console.debug('Waiting for application to rebuild.');

    if (waiting) {
      return;
    }

    waiting = true;
    const glyphs = ['☱', '☲', '☴'];
    const title = document.title;
    let i = 0;
    setInterval(function () { document.title = glyphs[i++ % glyphs.length] + ' ' + title; }, 240);
  }

  function getWebSocket(url, encryptedSecret, onMessage) {
    return new Promise((resolve, reject) => {
      const webSocket = new WebSocket(url, encodeURIComponent(encryptedSecret));
      let opened = false;

      // Listen for messages before the socket opens so that the session initialization message,
      // which the provider sends first, can never be missed.
      webSocket.addEventListener('message', onMessage);

      function onOpen() {
        opened = true;
        clearEventListeners();
        resolve(webSocket);
      }

      function onClose(event) {
        if (opened) {
          // Open completed successfully. Nothing to do here.
          return;
        }

        let error = 'WebSocket failed to connect.';
        if (event instanceof ErrorEvent) {
          error = event.error;
        }

        clearEventListeners();
        reject(error);
      }

      function clearEventListeners() {
        webSocket.removeEventListener('open', onOpen);
        // The error event isn't as reliable, but close is always called even during failures.
        // If close is called without a corresponding open, we can reject the promise.
        webSocket.removeEventListener('close', onClose);
      }

      webSocket.addEventListener('open', onOpen);
      webSocket.addEventListener('close', onClose);
      if (window.Blazor?.removeEventListener && window.Blazor?.addEventListener)
      {
        webSocket.addEventListener('close', () => window.Blazor?.removeEventListener('enhancedload', displayChangesAppliedToast));
        window.Blazor?.addEventListener('enhancedload', displayChangesAppliedToast);
      }
    });
  }
}

function getMessageAndStack(error) {
  const message = error.message || '<unknown error>'
  let messageAndStack = error.stack || message
  if (!messageAndStack.includes(message)) {
    messageAndStack = message + "\n" + messageAndStack;
  }

  return messageAndStack
}

// Rendezvous with the WebAssembly initializer. Either module may create the object first because
// library initializer module evaluation order is not guaranteed; the initializer resolves it.
function hotReloadAgentSignal() {
  const agent = globalThis.__DOTNET_WATCH_HOT_RELOAD_AGENT ||= {};
  if (!agent.ready) {
    agent.ready = new Promise(resolve => {
      agent.setReady = () => {
        agent.isReady = true;
        resolve();
      };
    });
  }

  return agent;
}

function hasDeltaApplyApi() {
  return !!(hotReloadAgentSignal().applyHotReloadDeltas || window.Blazor?._internal?.applyHotReloadDeltas || window.Blazor?._internal?.applyHotReload);
}

// The provider sends the replay snapshot once, so applying it before the agent installed the apply
// API would drop those updates while still reporting success. Wait for the agent to finish starting.
// Runtimes that install the apply API through their own bootstrap never publish the signal, so the
// wait is bounded and best effort.
async function waitForDeltaApplyApi() {
  if (hasDeltaApplyApi()) {
    return true;
  }

  try {
    await withTimeout(hotReloadAgentSignal().ready, hotReloadAgentReadyTimeoutMs);
  } catch (error) {
    console.debug('Timed out waiting for the Hot Reload agent.', error);
  }

  return hasDeltaApplyApi();
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(`Timed out after ${milliseconds}ms.`), milliseconds);
    promise.then(
      value => { clearTimeout(timeout); resolve(value); },
      error => { clearTimeout(timeout); reject(error); });
  });
}

// Generates the secret this browser uses to authenticate the provider and encrypts it with the
// build-pinned public key. The secret itself never leaves the browser in clear text and is never
// persisted.
async function getSecret(serverKeyString) {
  if (!serverKeyString || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  const secretBytes = window.crypto.getRandomValues(new Uint8Array(32)); // 32-bytes of entropy

  // Based on https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo_import
  const binaryServerKey = str2ab(atob(serverKeyString));
  const serverKey = await window.crypto.subtle.importKey('spki', binaryServerKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ['encrypt']);
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, serverKey, secretBytes);
  return {
    encryptedSharedSecret: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    encodedSharedSecret: btoa(String.fromCharCode(...secretBytes)),
  };

  function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }
}

// SIG // Begin signature block
// SIG // MIInNgYJKoZIhvcNAQcCoIInJzCCJyMCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // vQ8My3DGTW+HxgZiUNsmjuabqwfgPK+wZOeCuzFNWv2g
// SIG // ggypMIIF5DCCA8ygAwIBAgITMwAAAcgkOsgeTZOIuwAA
// SIG // AAAByDANBgkqhkiG9w0BAQsFADBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MB4XDTI2MDQxNjE4NTc0MVoXDTI3MDQx
// SIG // NTE4NTc0MVowYzELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjENMAsG
// SIG // A1UEAxMELk5FVDCCASIwDQYJKoZIhvcNAQEBBQADggEP
// SIG // ADCCAQoCggEBAMJfsAP8OxCUF6ivbFnD75BCsACvUPfi
// SIG // Af/LQ2AsqaCvJWtki//fPx4BhRWbvVuA5Tn1RvESIwAA
// SIG // oBJic0fJfjHYrZeQ4Ga7AxdGESwJMP5LZYfbVYKef3k/
// SIG // slhO8ygk5JNvxgos4lfXPCoBDFNm9a0fHfrRjgEVOmLb
// SIG // andQPFM0MSKk+kiJtSIpB3dIWQhaMQ3t0XwVHo3XEDYo
// SIG // SY3qU/npr6shcxBFgdZcTf0AQsITzCHPFDUS+iPqdmLh
// SIG // /PIokqOhmxIgd5Q69vqYjASwq1sg9peqfsJKVY4C0idy
// SIG // /Uf4AtWU6qmfxbQGrxphgBM4YU21HyQ1CgtEscHdSEKk
// SIG // TrcCAwEAAaOCAZswggGXMA4GA1UdDwEB/wQEAwIHgDAf
// SIG // BgNVHSUEGDAWBgorBgEEAYI3TAgBBggrBgEFBQcDAzAd
// SIG // BgNVHQ4EFgQUwduFP95X0NdybDKqpv9jV3T9cfIwRQYD
// SIG // VR0RBD4wPKQ6MDgxHjAcBgNVBAsTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjEWMBQGA1UEBRMNNDY0MjIzKzUwNzU5
// SIG // NjAfBgNVHSMEGDAWgBR/WT9UIdqtT+8F5eaj1y0GlBII
// SIG // MTBgBgNVHR8EWTBXMFWgU6BRhk9odHRwOi8vd3d3Lm1p
// SIG // Y3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNyb3NvZnQl
// SIG // MjBDb2RlJTIwU2lnbmluZyUyMFBDQSUyMDIwMjQuY3Js
// SIG // MG0GCCsGAQUFBwEBBGEwXzBdBggrBgEFBQcwAoZRaHR0
// SIG // cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0
// SIG // cy9NaWNyb3NvZnQlMjBDb2RlJTIwU2lnbmluZyUyMFBD
// SIG // QSUyMDIwMjQuY3J0MAwGA1UdEwEB/wQCMAAwDQYJKoZI
// SIG // hvcNAQELBQADggIBAKNTJ0R6r3T/SAhdOUibRuJvosAa
// SIG // IssCd+bb8aUe/hDVbBovDkE3EtgWAm5CPeFOeYiqmpCt
// SIG // 3aJntyMvA/qtLuWeJymwvCd4E/qo2If/trHxzZ12yGjo
// SIG // xp822b46DKIFFbg0mvZ74f0WVRu+Ftae93BT4Hid2x0h
// SIG // MYQWtIgTjoGH0FJCETvfTBBgegscj1AY+zghBpgeK2Df
// SIG // 5+zZdCGr6s/s6/xecllnuoJIdD35AW4G/5yqjU7oztCZ
// SIG // Wzr21L1Dlsq6RYuFg/2yym7hd9V+Au6XojrKbpR9Vi5v
// SIG // HqqWXjmE6QF/BXRSXzNHmqZhtCjKynbcMHNeQkqy+5/3
// SIG // iPSvAs8Fd6oVHRJxc+CFCWVirnpm9tQHNvfyvEsjTxjm
// SIG // e5pyWvnz6bGQM8bm30Zto/6F1zviqMTCJ2+OORn3wFZv
// SIG // F+63NT4UB9FH7SxjdgFZoprwvQxnzvCujaOfosARxt/7
// SIG // DrOF26bvdUNRsJQSjhdzGVZp5nLCT6aYONqVI75oljrJ
// SIG // kBNTJ2nmNYeUxUKV2iyntZqIUIqHd+SHDAn+GcoI+Jo1
// SIG // 1J3pOuCTl6OygDdPJZW5UfcglKCfdoHSzFAEH/dvpT+U
// SIG // 8sA3xIseAAsH3nUjOwadeMLu1jkRC40u7CcVfqaDuUO9
// SIG // 58az54AQfjwWRT3JxzVAJT1v0BX6gkkyemgCcawdMIIG
// SIG // vTCCBKWgAwIBAgITMwAAADk7tjcZvwYdZwAAAAAAOTAN
// SIG // BgkqhkiG9w0BAQwFADCBiDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2VydGlm
// SIG // aWNhdGUgQXV0aG9yaXR5IDIwMTEwHhcNMjQwODA4MjA1
// SIG // NDE4WhcNMzYwMzIyMjIxMzA0WjBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MIICIjANBgkqhkiG9w0BAQEFAAOCAg8A
// SIG // MIICCgKCAgEA2AGcHuM4x6qVFgc1rbrm/ghj18fxMqF6
// SIG // Yd88g17WCktpXd2GDfbhbAfTotwdumewG6QIM2K2vKjR
// SIG // 21L8Rboj/IQv9stJjyEqlt9C5a6wE+v2prNhwPEJb+qe
// SIG // NvkmwjWzxs06DdtUBO9BUvi1x/TdpPJyzPxB4J0zSX/I
// SIG // dE5sn1CprMzWvpU8Q4nssv64QRvvfDpAK6Gzz1rW6/XN
// SIG // 6s5gyeyd5FHAJunJbXUhyCBTRxEoMOrWmNUnMhsgXr6i
// SIG // JddtF46yB4jzO7UXJB8rR9WRrJrxKZUdD+05/beZnhb2
// SIG // TRGLbZBb2ndSBILk5QOS0rHFwKYYvq1ct84ZJYcghXhi
// SIG // tMlNPo823LlESiMcm5kcCuQX1WcdMRFahOMDN8jeQ/7l
// SIG // vhqVR2GABnu2067VtWdd8dqo9iXas+zbSOLTcs5VayH+
// SIG // tp2ATXt6zmEv63qVXR5UetWGyyxE5Ym7PYxcwK3uLDuU
// SIG // U8b0tcoaOyaiefaCi0Z0ci4SDkmckwlWaLF3ktGWSaBh
// SIG // FkrOHFILDKgYirQ+FoDtj5U9y3mkIeSKNwggObSeWQr7
// SIG // QrJ6miVyoabRP8ZhBEyEcmUY46ZVCinfrBRVRiSVTL76
// SIG // 8NZ4SASjizuHE3qYht/YxIhD+Ih8xmAnELr2i6QxRcKs
// SIG // 4LdKQT/EiSCl+XbYwzWK2Rnfmc1eQyiVTWUCAwEAAaOC
// SIG // AU4wggFKMA4GA1UdDwEB/wQEAwIBhjAQBgkrBgEEAYI3
// SIG // FQEEAwIBADAdBgNVHQ4EFgQUf1k/VCHarU/vBeXmo9ct
// SIG // BpQSCDEwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEw
// SIG // DwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBRyLToC
// SIG // MZBDuRQFTuHqp8cx0SOJNDBaBgNVHR8EUzBRME+gTaBL
// SIG // hklodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
// SIG // bC9wcm9kdWN0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFf
// SIG // MDNfMjIuY3JsMF4GCCsGAQUFBwEBBFIwUDBOBggrBgEF
// SIG // BQcwAoZCaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jZXJ0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFfMDNf
// SIG // MjIuY3J0MA0GCSqGSIb3DQEBDAUAA4ICAQAUlB84KE/u
// SIG // iefp8sgwqtKU3VZgrAMWAB13KY5Q7cWszx3sH9b+JDoP
// SIG // FewOfsPlbjAzBh4vKy1wSp+SPPg1RFGBrPIy7nJHNCHg
// SIG // uqMDi1K1NwmHWikTGjuefk+48Fidu7T5MdK5UdN7RVNM
// SIG // 9WGKXL+mIWsOjdrFD0/gL46XnJ637aBN96QgJLnFL5xh
// SIG // 9Ii+CfQmSxUFUxhUjlAW7+qGcuGwQURTMbx++/SGOCQ7
// SIG // 6WSlX23LoaQ3i92d3vJrpDppH3LfhqIzWqbFrEGLo5Sf
// SIG // I2Xp+S66f92JMWdgMtOmk6Sv+aDlZJ8KINUw0LG2PjA8
// SIG // oLk6YebUNAi38w2iRtsfdQawU/VBvOwuhy5KosK8fT0i
// SIG // jd8M9OaxxH1jvkbipftFNfwB0E+jQjo4SiN/f3O4Vm3S
// SIG // o4ebrlhZATr1xkza54TUwHTl002Acr2BMTvMq8r9+DwH
// SIG // aqNbzwxP9YXlXm69ka2pr0VIvZFrMCsD6sM+5/okZjPg
// SIG // emAxkcHhLqzNZIpgG/RWKwLN/GB5T52q5db1t3Rq5iU4
// SIG // HnwM9w5gp1zdJ73iD7EvilwSFsHngk6ACTBhO7/10t4f
// SIG // akOp4lkAAFUNZFAJpd87kuDIrAoIthemKCtlgKNRIFyv
// SIG // 5V7w8VYyFVNCXS/irwn8BSZA3lbifXTVxjYvgDsZNAbW
// SIG // HfYccC99ARJY/TGCGeUwghnhAgEBMG4wVzELMAkGA1UE
// SIG // BhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0IENvZGUgU2ln
// SIG // bmluZyBQQ0EgMjAyNAITMwAAAcgkOsgeTZOIuwAAAAAB
// SIG // yDANBglghkgBZQMEAgEFAKCBrjAZBgkqhkiG9w0BCQMx
// SIG // DAYKKwYBBAGCNwIBBDAcBgorBgEEAYI3AgELMQ4wDAYK
// SIG // KwYBBAGCNwIBFTAvBgkqhkiG9w0BCQQxIgQg7o+7wbui
// SIG // zRyE40OwarCqVCcnFuDEjw0wB3Ts9vnYfk0wQgYKKwYB
// SIG // BAGCNwIBDDE0MDKgFIASAE0AaQBjAHIAbwBzAG8AZgB0
// SIG // oRqAGGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbTANBgkq
// SIG // hkiG9w0BAQEFAASCAQA6L2AqQBaw2J1LLVWSpPEkOzMZ
// SIG // tR+Nm30+V2VFOH7xjD6iHuBq3SWHSMOPtIOikcZjyVF6
// SIG // AL3Jb/7rfRInZ2sICICTH2vc5npiRH2wKkPm0Q72xAMc
// SIG // FF3bdWHW3pNDuNNja4TRknoCwsfIzlYQ8fb2Jvxp2wYZ
// SIG // MU4oxMRsXEFujPsBrVYTmIdMua7Jodb+wI3eQqUfCHFT
// SIG // rm0805kUBZE6kZrvnLsRTBosnb4QZfcP/5P47lfVlv7M
// SIG // ovOK2GojvVWp/uz5YbIwEZTy6aSd/oiWmSXf8PiP44oD
// SIG // d8Ix+RbzD1rzBDPhfQy5L3j/LclHfiD5Om51mzib2/eU
// SIG // DUOl/k06oYIXlzCCF5MGCisGAQQBgjcDAwExgheDMIIX
// SIG // fwYJKoZIhvcNAQcCoIIXcDCCF2wCAQMxDzANBglghkgB
// SIG // ZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSCAT0w
// SIG // ggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIB
// SIG // BQAEIDBmB0AGKFZZJXFgyaV7iSvGpUHZqPAE5xnKW9bz
// SIG // ZIKfAgZq2UvNQ2kYEzIwMjYxMDMwMDQzMzA4Ljg5MVow
// SIG // BIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJh
// SIG // dGlvbnMxJzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjo4
// SIG // NjAzLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgU2VydmljZaCCEe0wggcgMIIFCKAD
// SIG // AgECAhMzAAACJYDHN8bNqndJAAEAAAIlMA0GCSqGSIb3
// SIG // DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
// SIG // YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
// SIG // VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
// SIG // BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEw
// SIG // MB4XDTI2MDIxOTE5NDAwMVoXDTI3MDUxNzE5NDAwMVow
// SIG // gcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1p
// SIG // Y3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNV
// SIG // BAsTHm5TaGllbGQgVFNTIEVTTjo4NjAzLTA1RTAtRDk0
// SIG // NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // U2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCC
// SIG // AgoCggIBAKbxEg/R4sDjpVwI+i++aqwiU3qqSbPkiwda
// SIG // ZRTSd5Sqny4bFp16j5LBYELBDlqVkj8M12ld/KJktlHp
// SIG // diClE8XN6kiXs4INvg20SyQkIhkORAw3Csf1jBTK7vUY
// SIG // aKCwsjF6V4e0De62hVN4eNLVvxSfA5FG2ScqTKtQCtPp
// SIG // mkHauh0hyZwty/fHfDCBiU6zQUSDkSxWtlvss1z+d3Rt
// SIG // cOn4dM5Za6Lx6hNXAl4vFxU/zr2gXyWLlJTzVpra0Ynr
// SIG // 8mx6OLP0kxbxIlcoFPYMJcw5SQKwaOic9lGp++gxIhBm
// SIG // C1o5PIAmWu+zLRNnvxesaqjKC1CKZCds4Avgo0tIK5bl
// SIG // NkRAZMcs5AkaCCBvePmAoLvvz5Eg8kD6f+GYcn/HipP8
// SIG // dNM+hV4wJy4EpatBdHX7+lhq7cXB7S1YjIb4tbORGv9k
// SIG // 08+6lwDZhyLeqfwdH1HC9CimpI0nCfZGLpqbwBDJ9VXL
// SIG // 8EHDS3qOmhE+PAq+5SN8LOlp7p247FC1DVcM308DbKX2
// SIG // wOSj/4BdX9I57x5rxChBy/ezcSuQb4unqGe/Do4w+Jqf
// SIG // iCA2RG2C0HuujU6Kik5Rcmf1jkQ7clQBc1y4z2b7kzLV
// SIG // US68bK2AAfe7GayVOdbdhut9rNrJIJJKdaSFo5nfeGBu
// SIG // 5RB8fufY0UQBRz9wXN+YJBSKRaKycljLAgMBAAGjggFJ
// SIG // MIIBRTAdBgNVHQ4EFgQUsTjSqhdO4wdfcB9lS7WfyfHa
// SIG // H3cwHwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ
// SIG // 6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5t
// SIG // aWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0
// SIG // JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3Js
// SIG // MGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
// SIG // cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0
// SIG // cy9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIw
// SIG // MjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUB
// SIG // Af8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4Aw
// SIG // DQYJKoZIhvcNAQELBQADggIBAAed9zbJTKgdlu+/JUoW
// SIG // 5eHkfHEci8hpH0lakh8hMmVz8qLTeO5H69yTOre2nl8U
// SIG // fksvt4gVdEi6h7Ayy9Z4Wta5+utbgeGaELCSoCt8DULT
// SIG // GT4dpizY7jxhLExf2WBLWRNMhvdix+gV0Wkq6s9/adzZ
// SIG // h3jAuD4WDCaTGR7ITcxQpWdrxJl5WkSOdLm5wVyTiys/
// SIG // ArY5EB/vQjbcYbI+GqAgpmmE1eFKxxMBCzIioHkbAMx1
// SIG // FXksrfs19ThibG8JiHdMVgT8aHTVDrIm9/0fGIRmnBb6
// SIG // hSTSCu4ehuDeyAhHmt+BSjyXfS9SdoNgxw8AKVoUwL9B
// SIG // sdlJpSFZdkbU45wynSD29hA0sMSoVfaOWq6/NVJLC0e2
// SIG // bUpOV0KNEQP6R0LJtw/Fs9qXAmKBdzUGwj0KK2dN/SWP
// SIG // Bv02Rn8lUjz8PratdfOHPgXe7SJUbPCdwZrFHEcb9e/i
// SIG // dOumQ556mhhs0FsxZLYbWo/dePulV/T7ipHIConSy2NC
// SIG // OhU4kiZU9ZGPPk9HcOfpp1BUwEkMzqAOuPWtlMVWAK1O
// SIG // KOoZlIbO9ekaQXe9izITpkOZr+QZ2JR7mxp4jqUfro+J
// SIG // ZZeCrG3uzLYTO/TIiNJW/54w5PZAxSJnpYJzuBW0CZel
// SIG // 94i6z42aAW8z4hzVfnx7gj0QvhlICJ1KlZbQZlMs0LTa
// SIG // avIuMIIHcTCCBVmgAwIBAgITMwAAABXF52ueAptJmQAA
// SIG // AAAAFTANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3Qg
// SIG // Q2VydGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAwHhcNMjEw
// SIG // OTMwMTgyMjI1WhcNMzAwOTMwMTgzMjI1WjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMDCCAiIwDQYJKoZIhvcN
// SIG // AQEBBQADggIPADCCAgoCggIBAOThpkzntHIhC3miy9ck
// SIG // eb0O1YLT/e6cBwfSqWxOdcjKNVf2AX9sSuDivbk+F2Az
// SIG // /1xPx2b3lVNxWuJ+Slr+uDZnhUYjDLWNE893MsAQGOhg
// SIG // fWpSg0S3po5GawcU88V29YZQ3MFEyHFcUTE3oAo4bo3t
// SIG // 1w/YJlN8OWECesSq/XJprx2rrPY2vjUmZNqYO7oaezOt
// SIG // gFt+jBAcnVL+tuhiJdxqD89d9P6OU8/W7IVWTe/dvI2k
// SIG // 45GPsjksUZzpcGkNyjYtcI4xyDUoveO0hyTD4MmPfrVU
// SIG // j9z6BVWYbWg7mka97aSueik3rMvrg0XnRm7KMtXAhjBc
// SIG // TyziYrLNueKNiOSWrAFKu75xqRdbZ2De+JKRHh09/SDP
// SIG // c31BmkZ1zcRfNN0Sidb9pSB9fvzZnkXftnIv231fgLrb
// SIG // qn427DZM9ituqBJR6L8FA6PRc6ZNN3SUHDSCD/AQ8rdH
// SIG // GO2n6Jl8P0zbr17C89XYcz1DTsEzOUyOArxCaC4Q6oRR
// SIG // RuLRvWoYWmEBc8pnol7XKHYC4jMYctenIPDC+hIK12Nv
// SIG // DMk2ZItboKaDIV1fMHSRlJTYuVD5C4lh8zYGNRiER9vc
// SIG // G9H9stQcxWv2XFJRXRLbJbqvUAV6bMURHXLvjflSxIUX
// SIG // k8A8FdsaN8cIFRg/eKtFtvUeh17aj54WcmnGrnu3tz5q
// SIG // 4i6tAgMBAAGjggHdMIIB2TASBgkrBgEEAYI3FQEEBQID
// SIG // AQABMCMGCSsGAQQBgjcVAgQWBBQqp1L+ZMSavoKRPEY1
// SIG // Kc8Q/y8E7jAdBgNVHQ4EFgQUn6cVXQBeYl2D9OXSZacb
// SIG // UzUZ6XIwXAYDVR0gBFUwUzBRBgwrBgEEAYI3TIN9AQEw
// SIG // QTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3Nv
// SIG // ZnQuY29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRt
// SIG // MBMGA1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsGAQQBgjcU
// SIG // AgQMHgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIBhjAPBgNV
// SIG // HRMBAf8EBTADAQH/MB8GA1UdIwQYMBaAFNX2VsuP6KJc
// SIG // YmjRPZSQW9fOmhjEMFYGA1UdHwRPME0wS6BJoEeGRWh0
// SIG // dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3JsL3By
// SIG // b2R1Y3RzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNy
// SIG // bDBaBggrBgEFBQcBAQROMEwwSgYIKwYBBQUHMAKGPmh0
// SIG // dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMv
// SIG // TWljUm9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0MA0GCSqG
// SIG // SIb3DQEBCwUAA4ICAQCdVX38Kq3hLB9nATEkW+Geckv8
// SIG // qW/qXBS2Pk5HZHixBpOXPTEztTnXwnE2P9pkbHzQdTlt
// SIG // uw8x5MKP+2zRoZQYIu7pZmc6U03dmLq2HnjYNi6cqYJW
// SIG // AAOwBb6J6Gngugnue99qb74py27YP0h1AdkY3m2CDPVt
// SIG // I1TkeFN1JFe53Z/zjj3G82jfZfakVqr3lbYoVSfQJL1A
// SIG // oL8ZthISEV09J+BAljis9/kpicO8F7BUhUKz/AyeixmJ
// SIG // 5/ALaoHCgRlCGVJ1ijbCHcNhcy4sa3tuPywJeBTpkbKp
// SIG // W99Jo3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP9pEB9s7G
// SIG // dP32THJvEKt1MMU0sHrYUP4KWN1APMdUbZ1jdEgssU5H
// SIG // LcEUBHG/ZPkkvnNtyo4JvbMBV0lUZNlz138eW0QBjloZ
// SIG // kWsNn6Qo3GcZKCS6OEuabvshVGtqRRFHqfG3rsjoiV5P
// SIG // ndLQTHa1V1QJsWkBRH58oWFsc/4Ku+xBZj1p/cvBQUl+
// SIG // fpO+y/g75LcVv7TOPqUxUYS8vwLBgqJ7Fx0ViY1w/ue1
// SIG // 0CgaiQuPNtq6TPmb/wrpNPgkNWcr4A245oyZ1uEi6vAn
// SIG // Qj0llOZ0dFtq0Z4+7X6gMTN9vMvpe784cETRkPHIqzqK
// SIG // Oghif9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGC
// SIG // A1AwggI4AgEBMIH5oYHRpIHOMIHLMQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmlj
// SIG // YSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRT
// SIG // UyBFU046ODYwMy0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1p
// SIG // Y3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2WiIwoBATAH
// SIG // BgUrDgMCGgMVAFNv5so48CMIF+WHPDkRcG5JbF4OoIGD
// SIG // MIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAw
// SIG // DQYJKoZIhvcNAQELBQACBQDujlX4MCIYDzIwMjYxMDI5
// SIG // MjMzMjA4WhgPMjAyNjEwMzAyMzMyMDhaMHcwPQYKKwYB
// SIG // BAGEWQoEATEvMC0wCgIFAO6OVfgCAQAwCgIBAAICEosC
// SIG // Af8wBwIBAAICEzswCgIFAO6Pp3gCAQAwNgYKKwYBBAGE
// SIG // WQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQACAweh
// SIG // IKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEA
// SIG // GPnRki06zaBeONQj3qVVXsTzw3lcixF6/OtYQ0AyJx0M
// SIG // TwzTtsSUBdAU84rPZ4dfjzlEUvsk3D6HK8KRCKOOmHXQ
// SIG // u4g8igx6BgJbqwBLZJcp6Hi0cGF/tmBVxAUOhQnjLS9f
// SIG // eEppzpwtfjVEXJ4CluoaVCc+Oy7j8+HYXihmnk4lWSpl
// SIG // eIJTNvvSv1No8cnbgqM+qo9zBfb2iRixs5R9h5gYbQD9
// SIG // pVESSen+Gy4thCpkngS9P7c+InXIcVhvP+lHw9jGxiCE
// SIG // foAZj3n0RL49Y0Pu6qHxvPLPMLB648wRqLw+awgEh1OP
// SIG // u+CIYk8olBx+UyWUMWUqmM34+osgRIewOTGCBA0wggQJ
// SIG // AgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
// SIG // YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
// SIG // VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
// SIG // BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEw
// SIG // AhMzAAACJYDHN8bNqndJAAEAAAIlMA0GCWCGSAFlAwQC
// SIG // AQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQ
// SIG // AQQwLwYJKoZIhvcNAQkEMSIEIM0N6FPSUevHb9zV4ZSU
// SIG // azuzMXvlH/OtEiTvqmCTbqT8MIH6BgsqhkiG9w0BCRAC
// SIG // LzGB6jCB5zCB5DCBvQQgVg3uiHo43fL3YKYCX+UXQJjC
// SIG // uNZZA/p0JTFqM9IcoRAwgZgwgYCkfjB8MQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGlt
// SIG // ZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiWAxzfGzap3SQAB
// SIG // AAACJTAiBCDiSFnnU+hShEQWySVmoI1Ho+wX0UUGRjBH
// SIG // WxOnUHcQzzANBgkqhkiG9w0BAQsFAASCAgCOS+eGUecJ
// SIG // V9ICJ+yAPpy7Y6JEQJsmfMDlRF9U1ibbTIco84oCRRmL
// SIG // BUEOBnfj97OsVNvpVi4uBjanDhG1jBZaQsH3vy8n15DW
// SIG // oMrWfistl85rHczulC5GQRDwgLcneIBNSpj77sRpyuBy
// SIG // UCxv4UIdZleMMTzw8t/dh7ZWgGS53fyFQl+QTeDqLsDd
// SIG // y9pUXigAZMsLD8ZiVscdH2VhZPybzRwhuyvyORyFfwab
// SIG // 58TxdaWejAawIRWtSgcqoPncG4UBdacUg7kQUVUv1OnU
// SIG // i979XRpQXWsWaCEUaDxHLYahmWxYCT70TaPsFwC9JxGd
// SIG // KdtxdBiTriCNJ7pNDB0aMrlAV38ciM4ALUqLOt9eMq+m
// SIG // hIwIzRmAI7a7459mHoyKAt7pi1TAGVishxeNKVJnRUp0
// SIG // IglREAkONixU4imUm7ftvnEjjMgF+9DNsVjSJKEMy2Ll
// SIG // L7mA+qavuMkEqVfAFdhWAOfPN0NzRCpYto/ep9Pujhzk
// SIG // 0xXIjQYAdpUE4bAYpaqiqBw0FoXjqAlPoDG4fQv/Eaed
// SIG // dvOlA4QY5+Mi649wKhxm3u9VYNoTvRDm7+dm33q2C9v3
// SIG // zBd/tvJF8GqQ2/rnXL+DhXzeEsPkJIUhukcVdBT0EtzF
// SIG // acbSICAOtsyAPqzfRCyi+4XTukzo1u0xyJCoKDyPDgkv
// SIG // GX4AFyZdLAf8+g==
// SIG // End signature block
