// Polls Plugin — main.js
(function() {
  var pluginId = '';
  var currentRoomId = '';
  var currentUserId = '';
  var polls = {}; // pollId -> { question, options: [{text, votes: [userId]}], createdBy, createdAt }
  var pollCounter = 0;

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'pufferchat-host') return;
    var msg = data.message;

    switch (msg.type) {
      case 'init':
        pluginId = msg.payload.pluginId;
        currentRoomId = msg.payload.roomId || '';
        currentUserId = msg.payload.userId || '';
        registerCommands();
        loadPolls();
        break;

      case 'command-invoked':
        if (msg.payload.command === 'poll') {
          handleCreatePoll(msg.payload.args, msg.payload.roomId, msg.payload.sender);
        }
        break;

      case 'room-changed':
        currentRoomId = msg.payload.roomId;
        break;

      case 'message':
        handleVoteMessage(msg.payload);
        break;

      case 'storage-response':
        handleStorageResponse(msg.payload);
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
        command: 'poll',
        description: 'Create a poll: /poll "Question" "Option1" "Option2" ...',
        usage: '/poll "Question" "Option 1" "Option 2" ...',
      },
    });
  }

  function parseQuotedArgs(args) {
    var results = [];
    var regex = /"([^"]+)"/g;
    var match;
    while ((match = regex.exec(args)) !== null) {
      results.push(match[1]);
    }
    return results;
  }

  function handleCreatePoll(args, roomId, sender) {
    var parts = parseQuotedArgs(args);
    if (parts.length < 3) {
      sendToHost({
        type: 'send-message',
        payload: {
          roomId: roomId || currentRoomId,
          body: '\u{1F4CA} Usage: /poll "Question" "Option 1" "Option 2" ... (minimum 2 options)',
        },
      });
      return;
    }

    var question = parts[0];
    var options = parts.slice(1).map(function(text) {
      return { text: text, votes: [] };
    });

    var pollId = 'poll_' + (++pollCounter) + '_' + Date.now();
    polls[pollId] = {
      question: question,
      options: options,
      createdBy: sender || currentUserId,
      createdAt: Date.now(),
      roomId: roomId || currentRoomId,
    };

    // Build display message
    var msg = '\u{1F4CA} **POLL: ' + question + '**\n';
    options.forEach(function(opt, i) {
      msg += '  ' + (i + 1) + '. ' + opt.text + '\n';
    });
    msg += '\n_Vote by typing: !vote ' + pollId + ' <number>_';

    sendToHost({
      type: 'send-message',
      payload: {
        roomId: roomId || currentRoomId,
        body: msg,
      },
    });

    savePolls();
    renderPolls();
  }

  function handleVoteMessage(msgPayload) {
    var body = msgPayload.body || '';
    var match = body.match(/^!vote\s+(poll_\S+)\s+(\d+)/);
    if (!match) return;

    var pollId = match[1];
    var optionNum = parseInt(match[2], 10) - 1;
    var voter = msgPayload.sender;
    var poll = polls[pollId];

    if (!poll) return;
    if (optionNum < 0 || optionNum >= poll.options.length) return;

    // Remove previous vote from this user
    poll.options.forEach(function(opt) {
      var idx = opt.votes.indexOf(voter);
      if (idx !== -1) opt.votes.splice(idx, 1);
    });

    // Add new vote
    poll.options[optionNum].votes.push(voter);
    savePolls();
    renderPolls();
  }

  function renderPolls() {
    var container = document.getElementById('polls-container');
    var pollIds = Object.keys(polls);

    if (pollIds.length === 0) {
      container.innerHTML = '<div class="no-polls">No active polls. Use /poll "Question" "Option1" "Option2" ... to create one.</div>';
      return;
    }

    // Show most recent first
    pollIds.sort(function(a, b) {
      return (polls[b].createdAt || 0) - (polls[a].createdAt || 0);
    });

    container.innerHTML = pollIds.map(function(pollId) {
      var poll = polls[pollId];
      var totalVotes = poll.options.reduce(function(sum, opt) { return sum + opt.votes.length; }, 0);

      var optionsHtml = poll.options.map(function(opt, i) {
        var pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
        var hasVoted = opt.votes.indexOf(currentUserId) !== -1;
        return '<div class="poll-option ' + (hasVoted ? 'voted' : '') + '" onclick="window._votePoll(\'' + pollId + '\', ' + i + ')">'
          + '<div class="vote-btn ' + (hasVoted ? 'checked' : '') + '">' + (hasVoted ? '\u2713' : '') + '</div>'
          + '<span class="option-text">' + escapeHtml(opt.text) + '</span>'
          + '<div class="option-bar-container"><div class="option-bar" style="width:' + pct + '%"></div></div>'
          + '<span class="option-count">' + opt.votes.length + ' (' + pct + '%)</span>'
          + '</div>';
      }).join('');

      return '<div class="poll-card">'
        + '<div class="poll-question">\u{1F4CA} ' + escapeHtml(poll.question) + '</div>'
        + optionsHtml
        + '<div class="poll-footer">'
        + '<span>Total votes: ' + totalVotes + '</span>'
        + '<span>Created by ' + escapeHtml(poll.createdBy || 'unknown') + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // Global vote handler (called from onclick)
  window._votePoll = function(pollId, optionIndex) {
    var poll = polls[pollId];
    if (!poll) return;

    // Remove previous vote
    poll.options.forEach(function(opt) {
      var idx = opt.votes.indexOf(currentUserId);
      if (idx !== -1) opt.votes.splice(idx, 1);
    });

    // Add vote
    if (optionIndex >= 0 && optionIndex < poll.options.length) {
      poll.options[optionIndex].votes.push(currentUserId);
    }

    savePolls();
    renderPolls();
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  var pendingStorageCallbacks = {};
  var storageReqCounter = 0;

  function savePolls() {
    var reqId = 'save_' + (++storageReqCounter);
    sendToHost({
      type: 'storage-set',
      payload: { key: 'polls_data', value: JSON.stringify(polls), requestId: reqId },
    });
  }

  function loadPolls() {
    var reqId = 'load_' + (++storageReqCounter);
    pendingStorageCallbacks[reqId] = function(value) {
      if (value) {
        try { polls = JSON.parse(value); } catch(e) { polls = {}; }
      }
      renderPolls();
    };
    sendToHost({
      type: 'storage-get',
      payload: { key: 'polls_data', requestId: reqId },
    });
  }

  function handleStorageResponse(payload) {
    var cb = pendingStorageCallbacks[payload.requestId];
    if (cb) {
      delete pendingStorageCallbacks[payload.requestId];
      cb(payload.value);
    }
  }

  // Signal ready
  window.addEventListener('DOMContentLoaded', function() {
    sendToHost({ type: 'ready', payload: {} });
  });
  if (document.readyState !== 'loading') {
    sendToHost({ type: 'ready', payload: {} });
  }
})();
