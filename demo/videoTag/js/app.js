// (function(){
'use strict';

var codecString = '';
/**
 *  Set to whatever codec you are using
 */

// codecString = 'video/mp4; codecs="avc1.42C028"';
codecString = 'video/webm; codecs="vp8"';
// codecString = 'video/webm; codecs="vp9"';



var video = document.getElementById('video');
var mediaSource = new MediaSource();
video.src = window.URL.createObjectURL(mediaSource);
var buffer = null;
var queue = [];

var bufferArray = [];

function updateBuffer() {
    console.log(`updating=${buffer.updating}, queue size=${queue.length}`)
    if (queue.length > 0 && !buffer.updating) {
        buffer.appendBuffer(queue.shift());
    }
}
video.onerror = function () {
    console.log("Error " + video.error.code + "; details: " + video.error.message);
    // video.error = null;
}
/**
 * Mediasource
 */
function sourceBufferHandle() {
    console.log("sourceBufferHandle called");
    if (mediaSource.activeSourceBuffers.length > 0) {
        buffer = mediaSource.activeSourceBuffers[0]
        console.log("sourceBufferHandle call ignored, buffer:", buffer);
        return
    }
    buffer = mediaSource.addSourceBuffer(codecString);
    buffer.mode = 'sequence';

    buffer.addEventListener('update', function () { // Note: Have tried 'updateend'
        console.log('update');
        updateBuffer();
    });

    buffer.addEventListener('updateend', function () {
        console.log('updateend');
        updateBuffer();
    });

    initWS();
    console.log("sourceBufferHandle call end, buffer:", buffer);
}

mediaSource.addEventListener('sourceopen', sourceBufferHandle)

function initWS() {
    var ws = new WebSocket('ws://localhost:8081/live/任务管理器_mp4');
    ws.binaryType = "arraybuffer";

    ws.onopen = function () {
        console.info('WebSocket connection initialized');
    };
    var messageCount = 0;

    ws.onmessage = function (event) {
        console.info('Recived WS message.', event);
        if (typeof event.data === 'object') {
            if (buffer.updating || queue.length > 0) {
                queue.push(event.data);
            } else {
                buffer.appendBuffer(event.data);
                // messageCount ++;
                // if(messageCount > 5 && messageCount < 20){
                //     video.play();
                // }
            }
        }
    };

}


// })();