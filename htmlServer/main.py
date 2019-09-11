import sys
import time
import subprocess
import logging
from urllib.parse import quote

import cv2 as cv
from flask import Flask, Response, request, jsonify, render_template, redirect
from flask_socketio import SocketIO, emit

from configs import config
from win32utils.screen import get_window_hwnd, mousedown, mousemove, mouseup, phone_tool

logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'TestSecretKey'
socketio = SocketIO(app, cors_allowed_origins="*")

captures = {}

@app.after_request
def after_request(response):
    # 解决跨域访问问题
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,session_id')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,HEAD')
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route("/")
def main():
    vals = request.args.to_dict()
    return render_template("index.html", **vals)

# @app.route("/test")
# def test():
#     vals = request.args.to_dict()
#     return render_template("test.html", **vals)


@app.route("/streamManager/<name>", methods=["GET", "PUT", "DELETE"])
def ffmpeg_manager(name):
    """管理ffmpeg进程"""
    if request.method == "PUT":
        # 添加截图程序
        if name in captures and captures[name].poll() is None:
            logger.info("Current captures: %s", captures)
            return "exists", 200
        cmd = "..\\rd\\Scripts\\python.exe stream.py {}".format(name)
        captures[name] = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logger.info("Start %s", cmd)
        logger.info("Current captures: %s", captures)
        return "done", 200
    elif request.method == "DELETE":
        # 删除截图程序
        if name not in captures:
            logger.info("Current captures: %s", captures)
            return "none", 404
        captures[name].kill()
        del captures[name]
        logger.info("Current captures: %s", captures)
        return "done", 200
    elif request.method == "GET":
        # 获取截图程序信息
        if name not in captures:
            logger.info("Current captures: %s", captures)
            return "none", 404
        logger.info("Current captures: %s", captures)
        return jsonify({
            "name": name,
            "pid": captures[name].pid,
            "retcode": captures[name].poll(),
        }), 200
    logger.info("Current captures: %s", captures)
    return "Invalid", 400

# 鼠标相关动作
@socketio.on('mousemove', '/action')
def on_mousemove(message):
    logger.info("mousemove: %s", message)
    mousemove(message)

@socketio.on('mousedown', '/action')
def on_mousedown(message):
    logger.info("mousedown: %s", message)
    mousedown(message)

@socketio.on('mouseup', '/action')
def on_mouseup(message):
    logger.info("mouseup: %s", message)
    mouseup(message)

@socketio.on('phone_tool', '/action')
def on_phone_tool(message):
    logger.info("phone_tool: %s", message)
    phone_tool(message)

if __name__ == "__main__":
    socketio.run(app, config.ServerHost, config.ServerPort, debug=config.ServerDebug)

