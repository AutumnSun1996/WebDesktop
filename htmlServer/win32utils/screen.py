import os
import time
import sys
from functools import lru_cache

import cv2 as cv
import numpy as np

import win32con
import win32api
import win32ui
import win32gui
import win32process
import ctypes

from configs import config
import logging

logger = logging.getLogger(__name__)

WindowHWND = {}
WindowSize = {}
SideBar = {}

def cv_save(image, path=None):
    """保存图片
    为支持中文文件名, 不能使用cv.imread
    """
    ext = os.path.splitext(path)[1]
    data = cv.imencode(ext, image)[1]
    if path is None:
        return data.tobytes()
    dirname = os.path.dirname(path)
    if not os.path.exists(dirname):
        os.makedirs(dirname)
    data.tofile(path)

def jpg_data(image):
    """图片数据转化为jpg数据
    """
    data = cv.imencode(".jpg", image, [cv.IMWRITE_JPEG_QUALITY, 30])[1]
    return data.tobytes()

def cv_crop(data, rect):
    """图片裁剪"""
    min_x, min_y, max_x, max_y = rect
    return data[min_y:max_y, min_x:max_x]


def get_window_shot(hwnd, offset=(None, None), size=(None, None)):
    # 对后台应用程序截图，程序窗口可以被覆盖，但如果最小化后只能截取到标题栏、菜单栏等。
    # 使用自定义的窗口边缘和大小设置
    dx, dy = offset
    if dx is None:
        dx = 0
    if dy is None:
        dy = 0
    w, h = size

    window_w, window_h = detect_window_size(hwnd)
    if w is None:
        w = window_w - dx
    if h is None:
        h = window_h - dy
    if dx+w > window_w or dy+h > window_h:
        raise ValueError("截图区域超出窗口! 请检查配置文件")
    # logger.debug("截图: %dx%d at %dx%d", w, h, dx, dy)

    # 返回句柄窗口的设备环境、覆盖整个窗口，包括非客户区，标题栏，菜单，边框
    hwndDC = win32gui.GetWindowDC(hwnd)
    # 创建设备描述表
    mfcDC = win32ui.CreateDCFromHandle(hwndDC)
    # 创建内存设备描述表
    saveDC = mfcDC.CreateCompatibleDC()
    # 创建位图对象
    saveBitMap = win32ui.CreateBitmap()
    saveBitMap.CreateCompatibleBitmap(mfcDC, w, h)
    saveDC.SelectObject(saveBitMap)
    # 截图至内存设备描述表
    saveDC.BitBlt((0, 0), (w, h), mfcDC, (dx, dy), win32con.SRCCOPY)
    # 获取位图信息
    bmpinfo = saveBitMap.GetInfo()
    bmpdata = saveBitMap.GetBitmapBits(True)
    # 生成图像
    image_data = np.frombuffer(bmpdata, 'uint8')
    image_data = image_data.reshape((bmpinfo['bmHeight'], bmpinfo['bmWidth'], 4))
    image_data = cv.cvtColor(image_data, cv.COLOR_BGRA2BGR)
    # 内存释放
    win32gui.DeleteObject(saveBitMap.GetHandle())
    saveDC.DeleteDC()
    mfcDC.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwndDC)
    return image_data

@lru_cache(maxsize=32)
def get_window_hwnd(title):
    hwnd = win32gui.FindWindow(None, title)
    logger.info("Get hwnd=%s for name=%s", hwnd, title)
    return hwnd

@lru_cache(maxsize=32)
def get_window_size(title):
    hwnd = get_window_hwnd(title)    
    return detect_window_size(hwnd)

@lru_cache(maxsize=32)
def detect_window_size(hwnd):
    """获取窗口的大小信息"""
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    dpi = ctypes.windll.user32.GetDpiForWindow(hwnd)
    w = right - left
    h = bottom - top
    if dpi != 96:
        w = int(w * dpi / 96)
        h = int(h * dpi / 96)
    return w, h

@lru_cache(maxsize=32)
def get_sidebar_hwnd(title):
    hwnd = get_window_hwnd(title)
    cur_tid, cur_pid = win32process.GetWindowThreadProcessId(hwnd)

    def callback(hwnd, info):
        tid, pid = win32process.GetWindowThreadProcessId(hwnd)
        if pid != info["pid"]:
            return True
        text = win32gui.GetWindowText(hwnd)
        if text != "通过键盘调节GPS方位和移动速度":
            return True
        rect = win32gui.GetWindowRect(hwnd)
        size = (rect[2]-rect[0], rect[3]-rect[1])
        if size != (40,754):
            return True
        info["found"] = hwnd
        return False

    info = {"tid": cur_tid, "pid": cur_pid, "found": []}
    try:
        win32gui.EnumThreadWindows(cur_tid, callback, info)
    except:
        pass
    return info["found"]


def get_pos(data):
    # 向后台窗口发送单击事件，(x, y)为相对于窗口左上角的位置
    if "hwnd" not in data:
        data["hwnd"] = get_window_hwnd(data["name"])
    dx = data.get("offsetX", config.get_default("offsetX", data["name"]))
    dy = data.get("offsetY", config.get_default("offsetY", data["name"]))
    w = data.get("width", config.get_default("width", data["name"]))
    h = data.get("height", config.get_default("height", data["name"]))
    if w is None or h is None:
        window_w, window_h = get_window_size(data["name"])
        if w is None:
            w = window_w - dx
        if h is None:
            h = window_h - dy
    x = dx + w * data["pos"]["rx"]
    y = dy + h * data["pos"]["ry"]
    pos = win32api.MAKELONG(int(x), int(y))
    return pos

def mousedown(data):
    pos = get_pos(data)
    win32gui.SendMessage(data["hwnd"], win32con.WM_LBUTTONDOWN,
                         win32con.MK_LBUTTON, pos)

def mousemove(data):
    pos = get_pos(data)
    win32gui.SendMessage(data["hwnd"], win32con.WM_MOUSEMOVE,
                            win32con.MK_LBUTTON, pos)

def mouseup(data):
    pos = get_pos(data)
    win32gui.SendMessage(data["hwnd"], win32con.WM_LBUTTONUP, 0, pos)

def phone_tool(data):
    pos = win32api.MAKELONG(config.ToolPosX, config.ToolPosY.get(data["type"]))
    hwnd = get_sidebar_hwnd(data["name"])
    win32gui.SendMessage(hwnd, win32con.WM_LBUTTONDOWN,
                         win32con.MK_LBUTTON, pos)
    win32gui.SendMessage(hwnd, win32con.WM_LBUTTONUP, 0, pos)

if __name__ == "__main__":
    hwnd = get_window_hwnd("FGO1")
    print(hwnd)
    print(get_window_hwnd("FGO1"))
