
/**
 * Create a new Peer instance.
 *
 * client - stream reference (FIXME rename this?)
 * id - peer id generated by server
 * relation - parent or child node
 */
P2PTV.Peer = function(client, id, relation) {
  var self = this;

  self._client = client || null;
  if (null === self._client || undefined === self._client) {
    throw new Error('Peer expects client reference');
  }

  self.id = id || null;
  if (typeof self.id !== 'string') {
    throw new Error('Peer expects valid identifier');
  }

  if (relation !== 'parent' && relation !== 'child') {
    throw new Error('Peer expects valid relation');
  }

	// relationship
  self.isParent = ('parent' === relation);
  self.isChild = !self.isParent;

	// data channel
  self.pc = null;
  self.channel = null;

	// statistics
	// TODO

};

P2PTV.Peer.prototype = {
  /**
   * Send ArrayBuffer message to peer.
   * message - ArrayBuffer data to send.
   */
  send: function(message) {
    var self = this;
    if ('open' === self.channel.readyState) {
      self.channel.send(message);
    }
  },

 
  /**
   * Setup data channel with peer. 
   */
  setupDataChannel: function() {
    var self = this;
    self.channel.binaryType = 'arraybuffer';

    // on p2ptvchannel open 
    self.channel.onopen = function() {
      var readyState = self.channel.readyState;
      P2PTV.log(P2PTV.CHANNEL + ' state is: ' + readyState);
      if ('open' === readyState) {
        var testMessage = P2PTV.CHANNEL + ' test message';
        P2PTV.log('sent data channel message: "' + testMessage + '"');
        self.send(testMessage);
      }   
    };  

    // on p2ptvchannel close
    self.channel.onclose = function() {
      var readyState = self.channel.readyState;
      P2PTV.log(P2PTV.CHANNEL + ' state is: ' + readyState);
    }

    if (self.isParent) {
      // on parent p2ptvchannel message
      self.channel.onmessage = function(event) {
        var data = event.data;
        if (typeof data === 'string') {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' string: ' + data);
        } else {
          self._client._pushData(data);
        }
      };
    } else {
      // on child p2ptvchannel message
      self.channel.onmessage = function(event) {
        var data = event.data;
        if (typeof data === 'string') {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' string: ' + data);
        } else {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' ArrayBuffer: '
            + data.byteLength + ' bytes');
        }
      };
    }

    // on p2ptvchannel error
    self.channel.onerror = function(err) {
      P2PTV.log(P2PTV.CHANNEL + ' error: ' + err.toString());
    };

    P2PTV.log('setup ' + P2PTV.CHANNEL);
  }


};

P2PTV.Peer.prototype.constructor = P2PTV.Peer;
