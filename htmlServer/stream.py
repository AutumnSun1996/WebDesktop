import os
import sys
import signal
import time
from urllib.parse import unquote, quote
import subprocess

import win32gui
import win32con
import win32ui


def get_window_shot(hwnd, offset=(None, None), size=(None, None)):
    # 对后台应用程序截图，程序窗口可以被覆盖，但如果最小化后只能截取到标题栏、菜单栏等。
    # 使用自定义的窗口边缘和大小设置
    dx, dy = offset
    w, h = size

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
    # image_data = bmpdata.copy()
    # 内存释放
    win32gui.DeleteObject(saveBitMap.GetHandle())
    saveDC.DeleteDC()
    mfcDC.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwndDC)
    return bmpdata


t0 = time.time()
url_name = unquote(sys.argv[1])
name = url_name
if "_" in name:
    name = name.split("_")[0]
hwnd = win32gui.FindWindow(None, name)
print("Get hwnd for "+name, hwnd)
if hwnd == 0:
    sys.exit(1)
frame = get_window_shot(hwnd, (2, 32), (1280, 720))
w, h = (1280, 720)

if url_name.endswith("_mpeg1"):
    args = [
        'ffmpeg', '-re',
        '-f', 'rawvideo', '-pix_fmt', 'rgb32',
        '-s', '{}x{}'.format(w, h), '-i', 'pipe:0',
        '-f', 'mpegts', '-codec:v', 'mpeg1video',
        '-b:v', '500k',
        '-r', '24',
        'http://127.0.0.1:8081/stream/' + quote(url_name)
        # 'tcp://127.0.0.1:9090'
    ]
elif url_name.endswith("_h264"):
    args = [
        'ffmpeg', '-re',
        '-hwaccel', 'cuda',
        '-f', 'rawvideo', '-pix_fmt', 'rgb32',
        '-s', '{}x{}'.format(w, h), '-i', 'pipe:0',
        '-f', 'h264',
        '-vcodec', 'h264_nvenc',
        '-profile:v', 'main',
        '-g', '25',
        '-r', '25',
        '-b:v', '800k',
        '-keyint_min', '250',
        '-strict', 'experimental',
        '-pix_fmt', 'yuv420p',
        # '-movflags', 'empty_moov+default_base_moof',
        '-an',
        # '-preset', 'ultrafast',
        'http://127.0.0.1:8081/stream/' + quote(url_name)
    ]
else:
    args = [
        'ffmpeg', '-re',
        '-hwaccel', 'cuda',
        '-f', 'rawvideo', '-pix_fmt', 'rgb32',
        '-s', '{}x{}'.format(w, h), '-i', 'pipe:0',
        '-f', 'mpegts', '-codec:v', 'hevc_nvenc',
        '-profile:v', 'main',
        '-g', '25',
        '-r', '25',
        '-b:v', '800k',
        '-keyint_min', '250',
        '-strict', 'experimental',
        '-pix_fmt', 'yuv420p',
        'http://127.0.0.1:8081/stream/' + quote(url_name)
        # "test265.mp4"
        # 'tcp://127.0.0.1:9090'
    ]

print(" ".join(args))
# process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
process = subprocess.Popen(args, stdin=subprocess.PIPE, )
print('{"ExtraPid": %d}' % process.pid, flush=True)
while True:
    try:
        frame = get_window_shot(hwnd, (2, 32), (1280, 720))
        # data = frame.astype("uint8").tobytes()
        process.stdin.write(frame)
        process.stdin.flush()
        time.sleep(1/60)
    except KeyboardInterrupt:
        print('KeyboardInterrupt', flush=True)
        break


try:
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
except AttributeError:
    process.kill(signal.CTRL_C_EVENT)