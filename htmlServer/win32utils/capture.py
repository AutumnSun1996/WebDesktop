import time
import threading
import logging

import cv2 as cv

from win32utils.screen import get_window_shot, get_window_hwnd, jpg_data
from configs import config

logger = logging.getLogger(__name__)

def size_str(size):
    units = ["B", "KB", "MB", "GB"]
    for unit in units:
        if size < 1000:
            break
        size = size / 1024
    return "%.2f%s" % (size, unit)

class WindowCapture(threading.Thread):
    def __init__(self, name):
        super().__init__(name=name)
        self.name = name
        self.hwnd = get_window_hwnd(name)
        assert self.hwnd != 0
        self.offset = (config.get_default("offsetX", name), config.get_default("offsetY", name))
        self.size = (config.get_default("width", name), config.get_default("height", name))
        # 标记是否被暂停
        self._not_paused = threading.Event()
        self._not_paused.set()
        # 标记是否有新数据
        self._new_frame = threading.Event()
        self._new_frame.clear()
        self.timestamp = time.time()
        self.last_fetch = time.time()
        self._data = None
    
    def frame_generator(self):
        self.resume()
        last_fetch = 0
        bytes_sent = 0
        last_tick = None
        while True:
            while last_fetch > self.timestamp or self._data is None:
                # logger.debug("Wait for fetch since %f > %f", last_fetch, self.timestamp)
                time.sleep(1/60)
            data = b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'
            data = data + self._data + b"\r\n"
            self.last_fetch = last_fetch = time.time()
            logger.debug("Fetched %s at %.3f", self.name, last_fetch)
            if last_tick is None:
                last_tick = self.last_fetch
            bytes_sent += len(data)
            dt = last_fetch - last_tick
            if dt > 5:
                logger.warning("%s sent %s in %.3fs at %s/s", self.name, size_str(bytes_sent), dt, size_str(bytes_sent / dt))
                last_tick = last_fetch
                bytes_sent = 0
            yield data

    def resume(self):
        self._not_paused.set()

    def run(self):
        while True:
            self._not_paused.wait()
            # 截图
            data = get_window_shot(self.hwnd, self.offset, self.size)
            data = cv.resize(data, (0, 0), fx=0.5, fy=0.5)
            self._data = jpg_data(data)
            last_timestamp = self.timestamp
            self.timestamp = time.time()
            logger.debug("Shot at %.3f", self.timestamp)
            # 设置新数据标记
            self._new_frame.set()
            interval = 1/10 - (self.timestamp - last_timestamp)
            if interval > 0:
                logger.debug("Wait for %.3fs", interval)
                time.sleep(interval)

            no_fetch = time.time() - self.last_fetch
            if no_fetch > 10:
                logger.info("%s pause for no fetch in %.3f", self.name, no_fetch)
                self._not_paused.clear()
