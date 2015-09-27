'use strict';

var P2PTV = P2PTV || {

  VERSION: 'v0.3.0',
  CHANNEL: 'p2ptvchannel',
  ICE_SERVERS: [{url: 'stun:stun.l.google.com:19302'}],
  PC_CONSTRAINTS: {optional: [{DtlsSrtpKeyAgreement: true}]},
  DC_CONSTRAINTS: {reliable: false, id: this.CHANNEL},
  STREAMS: {},

  /**
   * This function is used for logging.
   * text - The text to log.
   */
  log: function(text) {
    if (text[text.length - 1] === '\n') {
      text = text.substring(0, text.length - 1); 
    }
    if (window.performance) {
      var now = (window.performance.now() / 1000).toFixed(3);
      console.log(now + ': ' + text);
    } else {
      console.log(text);
    }
  },

  /**
   * P2PTV uses a custom WebRTC adapter. We store the WebRTC references
   * internally to avoid breaking other WebRTC applications.
   */
  RTCPeerConnection: null,
  RTCSessionDescription: null,
  RTCIceCandidate: null,
  detectedBrowser: 'unknown',
  _initialized: false,

  /**
   * A custom WebRTC adapter that works with spoofed user agents. 
   * Supports bare minimum features for maximum browser coverage.
   *
   * See: https://github.com/webrtc/adapter
   */
  adapter: function() {
    this.log('P2PTV ' + this.VERSION);
    if (!this._initialized) {
      this._initialized = true;

      // check user agent string for browser
      if (navigator.userAgent.match(/Edge/)) {
        this.log('This appears to be Edge');
        this.detectedBrowser = 'edge';
      } else if (navigator.userAgent.match(/Firefox/)) {
        this.log('This appears to be Firefox');
        this.detectedBrowser = 'firefox';
      } else if (navigator.userAgent.match(/(OPR|Opera)/)) {
        this.log('This appears to be Opera');
        this.detectedBrowser = 'opera';
      } else if (navigator.userAgent.match(/Chrom(e|ium)/)) {
        this.log('This appears to be Chrome');
        this.detectedBrowser = 'chrome';
      } else {
        this.log('This browser may not be supported');
        this.detectedBrowser = 'unknown';
      }

      if (typeof window === 'undefined' || !window.navigator) {
        // definitely not supported
        this.log('This does not appear to be a browser');
        this.detectedBrowser = 'not supported';
      } else if (!!window.mozRTCPeerConnection) {
        // has moz prefix -- firefox
        this.log('has prefix: moz');
        this.detectedBrowser = 'firefox';
        this.RTCPeerConnection = function(pcConfig, pcConstraints) {
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {url: server.urls[j]};
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
          return new mozRTCPeerConnection(pcConfig, pcConstraints);
        };
        this.RTCSessionDescription = window.RTCSessionDescription
          || window.mozRTCSessionDescription;
        this.RTCIceCandidate = window.RTCIceCandidate
          || window.mozRTCIceCandidate;

      } else if (!!window.webkitRTCPeerConnection) {
        // has webkit prefix -- chrome or opera 
        this.log('has prefix: webkit');
        if (this.detectedBrowser !== 'opera') {
          this.detectedBrowser = 'chrome';
        }
        this.RTCPeerConnection = function(pcConfig, pcConstraints) {
          return new webkitRTCPeerConnection(pcConfig, pcConstraints);
        };  
        ['createOffer', 'createAnswer'].forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            var self = this;
            if (arguments.length < 1 || (arguments.length === 1 &&
                typeof(arguments[0]) === 'object')) {
              var opts = arguments.length === 1 ? arguments[0] : undefined;
              return new Promise(function(resolve, reject) {
                nativeMethod.apply(self, [resolve, reject, opts]);
              });
            } else {
              return nativeMethod.apply(this, arguments);
            }   
          };  
        });
        ['setLocalDescription', 'setRemoteDescription',
            'addIceCandidate'].forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            var args = arguments;
            var self = this;
            return new Promise(function(resolve, reject) {
              nativeMethod.apply(self, [args[0],
                  function() {
                    resolve();
                    if (args.length >= 2) {
                      args[1].apply(null, []);
                    }
                  },
                  function(err) {
                    reject(err);
                    if (args.length >= 3) {
                      args[2].apply(null, [err]);
                    }
                  }]
                );
            });
          };
        });
        this.RTCSessionDescription = window.RTCSessionDescription
          || window.webkitRTCSessionDescription;
        this.RTCIceCandidate = window.RTCIceCandidate
          || window.webkitRTCIceCandidate;
      } else {
        this.log('Your browser doesn\'t appear to support WebRTC');
        this.detectedBrowser('not supported');
      }
    }

  },

  /**
   * Checks support for all APIs used by P2PTV. Returns true if the browser 
   * supports all APIs, otherwise false is returned and results can be
   * parsed for more information.
   *
   * results - An empty object to be populated with API support results.
   */
  isSupported: function(results) {
    results = {};

    if (!this._initialized) {
      throw new Error('Must initialize P2PTV before checking for support');
    }

    // check WebSocket support
    results.supportsWebSocket = !!window.WebSocket;
    // check WebRTC v1.0 support -- internal references generated by adapter
    results.supportsRTCPeerConnection = !!this.RTCPeerConnection;
    results.supportsRTCSessionDescription = !!this.RTCSessionDescription;
    results.supportsRTCIceCandidate = !!this.RTCIceCandidate;
    // check MSE support
    results.supportsMediaSource = !!window.MediaSource;

    var supported = true;
    Object.keys(results).forEach(function(key) {
      supported = supported && results[key];
    });

    return supported;
  },

  /** 
  * Generates a unique stream id. 
  */
  generateStreamId: function() {
    var self = this;
    var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      +'abcdefghijklmnopqrstuvwxyz0123456789';
    var id = ''; 
    for (var i = 0; i < 12; i++) {
      var randomPoz = Math.floor(Math.random()*charSet.length);
      id += charSet.substring(randomPoz, randomPoz+1);
    }   
    return (id in self.STREAMS) ? self.generateStreamId() : id; 
  }

};