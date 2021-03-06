Faye.Engine.Memory = Faye.Class(Faye.Engine.Base, {
  className: 'Engine.Memory',

  initialize: function(options) {
    this._clients   = {};
    this._channels  = {};
    this._messages  = {};
    this._namespace = new Faye.Namespace();
    
    Faye.Engine.Base.prototype.initialize.call(this, options);
  },
  
  createClient: function(callback, scope) {
    var clientId = this._namespace.generate();
    this.debug('Created new client ?', clientId);
    this._clients[clientId] = new Faye.Set();
    this.ping(clientId);
    callback.call(scope, clientId);
  },
  
  destroyClient: function(clientId, callback, scope) {
    var clients = this._clients;
    if (!clients.hasOwnProperty(clientId)) return;
    clients[clientId].forEach(function(channel) {
      this.unsubscribe(clientId, channel);
    }, this);
    this.removeTimeout(clientId);
    delete clients[clientId];
    delete this._messages[clientId];
    this.debug('Destroyed client ?', clientId);
    if (callback) callback.call(scope);
  },
  
  clientExists: function(clientId, callback, scope) {
    callback.call(scope, this._clients.hasOwnProperty(clientId));
  },
  
  ping: function(clientId) {
    var timeout = this._options.timeout;
    if (typeof timeout !== 'number') return;
    this.debug('Ping ?, ?', clientId, timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    var clients = this._clients, channels = this._channels;
    clients[clientId] = clients[clientId] || new Faye.Set();
    channels[channel] = channels[channel] || new Faye.Set();
    clients[clientId].add(channel);
    channels[channel].add(clientId);
    this.debug('Subscribed client ? to channel ?', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    var clients = this._clients, channels = this._channels;
    if (clients.hasOwnProperty(clientId)) clients[clientId].remove(channel);
    if (channels.hasOwnProperty(channel)) channels[channel].remove(clientId);
    this.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  publish: function(message) {
    this.debug('Publishing message ?', message);

    var channels = Faye.Channel.expand(message.channel),
        messages = this._messages;
    
    Faye.each(channels, function(channel) {
      var clients = this._channels[channel];
      if (!clients) return;
      clients.forEach(function(clientId) {
        this.debug('Queueing for client ?: ?', clientId, message);
        messages[clientId] = messages[clientId] || new Faye.Set();
        messages[clientId].add(message);
        this.emptyQueue(clientId);
      }, this);
    }, this);
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false),
        messages = this._messages[clientId];
    
    if (!conn || !messages) return;
    delete this._messages[clientId];
    messages.forEach(conn.deliver, conn);
  }
});

Faye.Engine.register('memory', Faye.Engine.Memory);
