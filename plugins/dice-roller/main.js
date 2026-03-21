// Dice Roller Plugin — main.js
(function() {
  var pluginId = '';
  var currentRoomId = '';
  var rollHistory = [];

  // Listen for messages from PufferChat host
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
        if (msg.payload.command === 'roll') {
          handleRoll(msg.payload.args, msg.payload.roomId, msg.payload.sender);
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
        command: 'roll',
        description: 'Roll dice (e.g., /roll 2d6, /roll d20+3)',
        usage: '/roll <dice expression>',
      },
    });
  }

  function parseDiceExpression(expr) {
    expr = expr.trim().toLowerCase();
    if (!expr) expr = '1d6';

    // Match patterns like "2d6", "d20", "4d8+3", "2d6-1"
    var match = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) {
      return null;
    }

    var count = parseInt(match[1] || '1', 10);
    var sides = parseInt(match[2], 10);
    var modifier = parseInt(match[3] || '0', 10);

    // Validate
    var validDice = [4, 6, 8, 10, 12, 20, 100];
    if (validDice.indexOf(sides) === -1 && sides < 2) {
      return null;
    }
    if (count < 1 || count > 100) {
      return null;
    }

    return { count: count, sides: sides, modifier: modifier };
  }

  function rollDice(count, sides) {
    var results = [];
    for (var i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * sides) + 1);
    }
    return results;
  }

  function handleRoll(args, roomId, sender) {
    var parsed = parseDiceExpression(args);
    if (!parsed) {
      sendToHost({
        type: 'send-message',
        payload: {
          roomId: roomId || currentRoomId,
          body: '\u{1F3B2} Invalid dice expression. Use format: NdN (e.g., 2d6, d20, 4d8+3). Supported: d4, d6, d8, d10, d12, d20, d100',
        },
      });
      return;
    }

    var results = rollDice(parsed.count, parsed.sides);
    var sum = results.reduce(function(a, b) { return a + b; }, 0);
    var total = sum + parsed.modifier;

    var modStr = '';
    if (parsed.modifier > 0) modStr = '+' + parsed.modifier;
    else if (parsed.modifier < 0) modStr = '' + parsed.modifier;

    var expression = parsed.count + 'd' + parsed.sides + modStr;
    var breakdown = results.join(', ');
    if (parsed.modifier !== 0) {
      breakdown += ' ' + modStr;
    }

    var resultMsg = '\u{1F3B2} Rolling ' + expression + ': [' + breakdown + '] = **' + total + '**';

    // Send result to chat
    sendToHost({
      type: 'send-message',
      payload: {
        roomId: roomId || currentRoomId,
        body: resultMsg,
      },
    });

    // Update UI
    displayRoll(results, parsed.sides, total, expression, breakdown);

    // Save to history
    rollHistory.unshift({
      expression: expression,
      results: results,
      total: total,
      time: new Date().toLocaleTimeString(),
    });
    if (rollHistory.length > 20) rollHistory.pop();
    updateHistory();
  }

  function displayRoll(results, sides, total, expression, breakdown) {
    var display = document.getElementById('dice-display');
    display.innerHTML = '';

    results.forEach(function(value, i) {
      var die = document.createElement('div');
      die.className = 'die';
      die.textContent = value;
      die.style.animationDelay = (i * 0.1) + 's';
      display.appendChild(die);
    });

    var resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';
    document.getElementById('total').textContent = total;
    document.getElementById('breakdown').textContent = expression + ': [' + breakdown + ']';
  }

  function updateHistory() {
    var historyDiv = document.getElementById('history');
    if (rollHistory.length === 0) {
      historyDiv.innerHTML = '<div style="color:#888;text-align:center;">No rolls yet</div>';
      return;
    }
    historyDiv.innerHTML = rollHistory.map(function(entry) {
      return '<div class="history-item"><strong>' + entry.expression + '</strong> = ' + entry.total + ' <span style="color:#888;">(' + entry.time + ')</span></div>';
    }).join('');
  }

  // Signal ready
  window.addEventListener('DOMContentLoaded', function() {
    sendToHost({ type: 'ready', payload: {} });
  });
  if (document.readyState !== 'loading') {
    sendToHost({ type: 'ready', payload: {} });
  }
})();
