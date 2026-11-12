/**
 * DeepGuard AI — Logger
 * Unified, prefixed console logging for all extension modules.
 * Can be silenced in production by setting DEEPGUARD_DEBUG=false in storage.
 */

const Logger = (() => {
  const PREFIX   = '[DeepGuard]';
  const STYLES = {
    info:    'color:#00d4ff;font-weight:600',
    warn:    'color:#f59e0b;font-weight:600',
    error:   'color:#ef4444;font-weight:700',
    success: 'color:#10b981;font-weight:600',
    debug:   'color:#6b7280;font-weight:400',
  };

  let _enabled = true;

  // Check storage for debug flag (async — sets flag when resolved)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('deepguard_debug', (r) => {
      _enabled = r.deepguard_debug !== false;
    });
  }

  const _log = (level, ...args) => {
    if (!_enabled && level === 'debug') return;
    const style = STYLES[level] || STYLES.info;
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `%c${PREFIX}`, style, ...args
    );
  };

  return {
    info:    (...a) => _log('info',    ...a),
    warn:    (...a) => _log('warn',    ...a),
    error:   (...a) => _log('error',   ...a),
    success: (...a) => _log('success', ...a),
    debug:   (...a) => _log('debug',   ...a),
    setEnabled: (v) => { _enabled = v; },
  };
})();

if (typeof module !== 'undefined') {
  module.exports = Logger;
}
