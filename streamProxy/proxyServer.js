// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay yoursecret 8081 8082
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws'),
	url = require('url'),
	log4js = require('log4js');

log4js.configure({
	appenders: {
		console: {//记录器1:输出到控制台
			type: 'console',
		},
	},
	categories: {
		default: { appenders: ['console'], level: 'debug' }, //开发环境  输出到控制台
		console: { appenders: ['console'], level: 'debug' }, //开发环境  输出到控制台
	}
})
var logger = log4js.getLogger("main");

var STREAM_SECRET = process.argv[2] || "stream",
	STREAM_PORT = process.argv[3] || 8081;


var ffmpegProcess = {};
var mp4Headers = {};

function startProcess(name) {
	logger.info("Try Start Process", name)
	if (ffmpegProcess[name]) {
		logger.info("Process exists:", name)
		// return
	}
	http.request({
		host: "localhost",
		port: 8080,
		path: "/RemoteDroid/streamManager/" + encodeURI(name),
		method: "PUT"
	}).on('error', (e) => {
		logger.warn(`开启${name}出现问题: ${e.message}`);
	}).end()
}
function stopProcess(name) {
	logger.info("Try Stop Process", name)
	http.request({
		host: "localhost",
		port: 8080,
		path: "/RemoteDroid/streamManager/" + encodeURI(name),
		method: "DELETE"
	}).on('error', (e) => {
		logger.warn(`关闭${name}出现问题: ${e.message}`);
	}).end()
}

var bitRateRecords = {};
function updateBitRate(namespace, size) {
	var now = Date.now();
	if (!bitRateRecords[namespace]) {
		bitRateRecords[namespace] = {
			InitTimestamp: now,
			LastReport: now,
			TotalSize: 0
		}
	}
	var rec = bitRateRecords[namespace];
	rec.TotalSize += size;
	var dt = now - rec.LastReport;
	if (dt > 5000) {
		var br = rec.TotalSize / (now - rec.InitTimestamp);
		br = Number(br).toFixed(3);
		logger.info(`Stream bandwidth of ${namespace} = ${br} KB/s`)
		rec.LastReport = now;
	}
}

// Websocket Server
var wsServer = new WebSocket.Server({ perMessageDeflate: false, noServer: true });
wsServer.connectionCount = {};
wsServer.on('connection', function (client, upgradeReq) {
	var namespace = client.namespace;
	if (!wsServer.connectionCount[namespace]) {
		wsServer.connectionCount[namespace] = 0;
	}
	startProcess(namespace);
	wsServer.connectionCount[namespace]++;

	upgradeReq = (upgradeReq || client.upgradeReq)
	logger.info(
		'New WebSocket Connection for ' + namespace +
		' from ' + upgradeReq.socket.remoteAddress,
		upgradeReq.headers['user-agent'],
		'(now:' + JSON.stringify(wsServer.connectionCount) + ')'
	);

	if (/(_mp4|_vp8)$/.test(namespace)) {
		if (!mp4Headers[namespace]) {
			mp4Headers[namespace] = []
		}
		logger.info(`Send head of ${namespace}, size=${mp4Headers[namespace].length}`)
		mp4Headers[namespace].forEach((data) => {
			client.send(data);
		})
	}
	client.on('close', function (code, message) {
		wsServer.connectionCount[client.namespace]--;
		logger.info(
			'Disconnected WebSocket (now:' + JSON.stringify(wsServer.connectionCount) + ')'
		);

		if (wsServer.connectionCount[client.namespace] == 0) {
			// Wait for some time in case of reconnection
			setTimeout(function () {
				if (wsServer.connectionCount[client.namespace] == 0) {
					stopProcess(client.namespace)
				}
			}, 10000)
		}
	});
});
wsServer.broadcast = function (data, namespace) {
	// console.debug("Send data of", namespace, data.byteLength)
	updateBitRate(namespace, data.byteLength);
	wsServer.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN && namespace === client.namespace) {
			client.send(data);
		}
	});
};

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var httpServer = http.createServer(function (request, response) {
	const pathname = url.parse(request.url).pathname;
	var namespace = decodeURI(pathname.split("/")[2]);
	if (pathname.split("/")[1] !== STREAM_SECRET) {
		logger.info(`Stream connection failed for ${pathname} from ${request.socket.remoteAddress}:${request.socket.remotePort}`);
		response.end();
	}

	response.connection.setTimeout(0);
	ffmpegProcess[namespace] = true;
	logger.info(`Stream ${namespace} connected from ${request.socket.remoteAddress}:${request.socket.remotePort}`);
	request.on('data', function (data) {
		wsServer.broadcast(data, namespace);
		if (/(_mp4|_vp8)$/.test(namespace)) {
			if (!mp4Headers[namespace]) {
				mp4Headers[namespace] = []
			}
			if (mp4Headers[namespace].length < 3) {
				mp4Headers[namespace].push(data);
			}
		}
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end', function () {
		logger.info(`Stream ${namespace} closed`);
		ffmpegProcess[namespace] = null;
		bitRateRecords[namespace] = null;
		mp4Headers[namespace] = null;
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});
	// 录制
	// request.socket.recording = fs.createWriteStream(namespace+".mp4");
})

httpServer.on("upgrade", function upgrade(request, socket, head) {
	const pathname = url.parse(request.url).pathname;
	wsServer.handleUpgrade(request, socket, head, function done(ws) {
		ws.pathname = pathname
		ws.namespace = decodeURI(pathname.split("/")[2])
		logger.info("On Upgrade", ws.namespace)
		wsServer.emit('connection', ws, request);
	})
})

httpServer.listen(STREAM_PORT);

logger.info('Listening for incoming Streams on http://127.0.0.1:' + STREAM_PORT + '/' + STREAM_SECRET);
// logger.info('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');
