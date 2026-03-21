// Code Paste Plugin — main.js
(function() {
  var pluginId = '';
  var currentRoomId = '';
  var editor = null;
  var lineNumbers = null;

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'pufferchat-host') return;
    var msg = data.message;

    switch (msg.type) {
      case 'init':
        pluginId = msg.payload.pluginId;
        currentRoomId = msg.payload.roomId || '';
        registerCommands();
        break;

      case 'command-invoked':
        if (msg.payload.command === 'paste') {
          handlePasteCommand(msg.payload.args);
        }
        break;

      case 'room-changed':
        currentRoomId = msg.payload.roomId;
        break;
    }
  });

  function sendToHost(message) {
    window.parent.postMessage({
      source: 'pufferchat-plugin',
      pluginId: pluginId,
      message: message,
    }, '*');
  }

  function registerCommands() {
    sendToHost({
      type: 'register-command',
      payload: {
        command: 'paste',
        description: 'Open code editor panel to share syntax-highlighted code',
        usage: '/paste [language]',
      },
    });
  }

  function handlePasteCommand(args) {
    // If a language is specified, set it
    var lang = args.trim().toLowerCase();
    if (lang) {
      var select = document.getElementById('lang-select');
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === lang) {
          select.value = lang;
          break;
        }
      }
    }
    // Focus the editor
    if (editor) editor.focus();
    updateStatus();
  }

  function detectLanguage(code) {
    if (/^\s*(import|from|def |class |print\(|if __name__)/.test(code)) return 'python';
    if (/^\s*(function |const |let |var |import |export |=>)/.test(code)) return 'javascript';
    if (/^\s*(interface |type |enum |: string|: number)/.test(code)) return 'typescript';
    if (/^\s*(fn |let mut |pub |use |struct |impl |mod )/.test(code)) return 'rust';
    if (/^\s*(<html|<div|<span|<!DOCTYPE)/.test(code)) return 'html';
    if (/^\s*(\.|#|@media|body\s*{)/.test(code)) return 'css';
    if (/^\s*{[\s\n]*"/.test(code)) return 'json';
    if (/^\s*(#!/|apt|sudo|echo|cd |ls |grep|chmod)/.test(code)) return 'bash';
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)/i.test(code)) return 'sql';
    if (/^\s*(package |func |import "|go |defer )/.test(code)) return 'go';
    if (/^\s*(public class|private|protected|System\.out)/.test(code)) return 'java';
    if (/^\s*(using |namespace |Console\.|public static)/.test(code)) return 'csharp';
    if (/^\s*(#include|std::|cout|cin|int main)/.test(code)) return 'cpp';
    if (/^\s*[a-z_]+:(\s|$)/m.test(code) && /:\s*$/m.test(code)) return 'yaml';
    return 'plaintext';
  }

  function updateLineNumbers() {
    if (!editor || !lineNumbers) return;
    var lines = editor.value.split('\n').length;
    var nums = [];
    for (var i = 1; i <= Math.max(lines, 1); i++) {
      nums.push(i);
    }
    lineNumbers.textContent = nums.join('\n');
  }

  function updateStatus() {
    var code = editor ? editor.value : '';
    var lines = code.split('\n').length;
    var chars = code.length;
    var langSelect = document.getElementById('lang-select');
    var lang = langSelect.value;
    if (lang === 'auto' && code.trim()) {
      lang = detectLanguage(code) + ' (detected)';
    }
    document.getElementById('status-lines').textContent = 'Lines: ' + lines;
    document.getElementById('status-chars').textContent = 'Characters: ' + chars;
    document.getElementById('status-lang').textContent = 'Language: ' + lang;
  }

  // Copy code to clipboard
  window.copyCode = function() {
    if (!editor) return;
    navigator.clipboard.writeText(editor.value).then(function() {
      // Brief visual feedback
      var btn = document.querySelector('.btn-copy');
      var orig = btn.textContent;
      btn.textContent = '\u2713 Copied!';
      setTimeout(function() { btn.innerHTML = '&#x1F4CB; Copy'; }, 1500);
    }).catch(function() {
      // Fallback
      editor.select();
      document.execCommand('copy');
    });
  };

  // Send code to chat
  window.sendCode = function() {
    if (!editor || !editor.value.trim()) return;

    var code = editor.value;
    var langSelect = document.getElementById('lang-select');
    var lang = langSelect.value;
    if (lang === 'auto') lang = detectLanguage(code);

    var filename = document.getElementById('filename-input').value.trim() || 'code.' + getExtension(lang);
    var size = new Blob([code]).size;

    // Show transfer animation
    showTransferAnimation(filename, size);

    // Format as code block
    var body = '\u{1F4C4} **Code Paste** — `' + filename + '` (' + formatSize(size) + ')\n```' + lang + '\n' + code + '\n```';

    // Send to chat
    sendToHost({
      type: 'send-message',
      payload: {
        roomId: currentRoomId,
        body: body,
      },
    });
  };

  function getExtension(lang) {
    var map = {
      javascript: 'js', typescript: 'ts', python: 'py', rust: 'rs',
      html: 'html', css: 'css', json: 'json', bash: 'sh',
      sql: 'sql', go: 'go', java: 'java', csharp: 'cs',
      cpp: 'cpp', yaml: 'yml', markdown: 'md', plaintext: 'txt',
    };
    return map[lang] || 'txt';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showTransferAnimation(filename, size) {
    var display = document.getElementById('transfer-display');
    display.style.display = 'block';
    document.getElementById('ft-filename').textContent = filename;
    document.getElementById('ft-size').textContent = formatSize(size);
    document.getElementById('ft-status').textContent = 'Sending...';

    var bar = document.getElementById('ft-progress-bar');
    bar.style.width = '0%';

    var progress = 0;
    var interval = setInterval(function() {
      progress += Math.random() * 30 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        document.getElementById('ft-status').textContent = '\u2713 File transfer complete!';
        setTimeout(function() {
          display.style.display = 'none';
        }, 2000);
      }
      bar.style.width = Math.min(progress, 100) + '%';
    }, 200);
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', function() {
    editor = document.getElementById('code-editor');
    lineNumbers = document.getElementById('line-numbers');

    editor.addEventListener('input', function() {
      updateLineNumbers();
      updateStatus();
    });

    editor.addEventListener('scroll', function() {
      lineNumbers.scrollTop = editor.scrollTop;
    });

    // Handle tab key
    editor.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        updateLineNumbers();
        updateStatus();
      }
    });

    updateLineNumbers();
    updateStatus();

    sendToHost({ type: 'ready', payload: {} });
  });

  if (document.readyState !== 'loading') {
    sendToHost({ type: 'ready', payload: {} });
  }
})();
