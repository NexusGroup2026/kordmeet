function formatMessage(username, text) {
  return {
    username,
    text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now()
  };
}

module.exports = formatMessage;