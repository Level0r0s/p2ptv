
/**
 * TODO write description
 * stream -
 */
P2PTV.PushPullWindow = function(stream, player) {
  var self = this;

  self._stream = stream;
  if (!self._stream) {
    throw new Error('Must pass Stream reference to PushPullWindow');
  }

  self._player = player;
  if (!self._player) {
    throw new Error('Must pass Player reference to PushPullWindow');
  }

  self._initialTimecode = -1;
  self._lastInitSegment = null;
  self._initSegmentHash = {};
  self._mediaSegmentHash = {};

};

P2PTV.PushPullWindow.prototype = {

  /**
   * Push data received from parent into the window.

   * data - ArrayBuffer storing a P2PTV message. Byte length is a multiple 
   *        of 8 greater than or equal to 16.
   */
  pushData: function(data) {
    this._decode(data);
  },

  /**
   * // TODO write description
   * data -
   */
  _decode: function(data) {
    var self = this;

    var float64view = new Float64Array(data),
        uint8view = new Uint8Array(data, 8),
        int32view = new Int32Array(data);

    var type = uint8view[0] >> 6,
        timecode = float64view[0];
    
    switch (type) {
      case P2PTV.INIT_SEGMENT:
        var start = 9 + (0x07 & uint8view[0]);
        self._pushInitSegment({
          timecode: timecode,
          start: start,
          data: data
        }); 
        break;
      case P2PTV.MEDIA_SEGMENT_CHUNK:
        var padding = 0x07 & uint8view[0];
        self._pushMediaSegmentChunk({
          timecode: timecode,
          index: uint8view[1],
          finalIndex: uint8view[2],
          duration: int32view[3],
          start: padding + 16,
          data: data
        });
        break;
      /*
      case P2PTV.MEDIA_SEGMENT:
        var start = ??;
        self._pushMediaSegment({
          timecode: timecode,
          data: 
        });
        break;
      */
      default: // not implemented
    }

  },

  /**
   * TODO fill this out
   * initSegment - The decoded initialization segment message.
   */
  _pushInitSegment: function(initSegment) {
    var self = this;

/*
    // TODO should only be logged while debugging
    P2PTV.log('pushing initialization segment:'
      + ' timecode=' + initSegment.timecode
      + ', length=' + initSegment.data.byteLength + ' bytes');
*/

    self._initSegmentHash[initSegment.timecode] = initSegment;
    self._lastInitSegment = initSegment.data.slice(initSegment.start);
    self._player.appendInitSegment(self._lastInitSegment);

  },

  /**
   * TODO fill this out
   * chunk - The decoded media segment chunk message.
   */
  _pushMediaSegmentChunk: function(chunk) {
    var self = this;

/*
    // FIXME should only be logged while debugging
    var durationString = (chunk.duration > 0) ? chunk.duration : 'unknown';
    P2PTV.log('pushing media segment chunk:'
      + ' timecode=' + chunk.timecode 
      + ', chunkIndex=' + chunk.index
      + ', finalIndex=' + chunk.finalIndex
      + ', duration=' + durationString
      + ', length=' + chunk.data.byteLength + ' bytes');
*/

    var mediaSegment = null;
    if (!(chunk.timecode in self._mediaSegmentHash)) {
      mediaSegment = new P2PTV.MediaSegment(chunk);
      self._mediaSegmentHash[chunk.timecode] = mediaSegment;
    } else {
      mediaSegment = self._mediaSegmentHash[chunk.timecode]; 
      mediaSegment.addChunk(chunk);
    }

    if (mediaSegment.isComplete()) {
      if (self._initialTimecode < 0) {
        self._initialTimecode = chunk.timecode;
      }

      var timestampOffset = (chunk.timecode - self._initialTimecode)/1000;
      self._player.appendMediaSegment(
        mediaSegment.getBlob(),
        timestampOffset
      );
    }

  },
  
  /**
   * TODO write function description
   * mediaSegment - The decoded media segment message.
   */
  _pushMediaSegment: function(mediaSegment) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   */
  _pullInitSegment: function(timecode) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   * chunkIndex -
   */
  _pullMediaSegmentChunk: function(timecode, chunkIndex) {
    // TODO
  },

  /**
   * TODO write function description
   */
  reset: function() {
    // TODO
  }
};

P2PTV.PushPullWindow.prototype.constructor = P2PTV.PushPullWindow;
