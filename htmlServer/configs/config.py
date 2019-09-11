import logging
logging.basicConfig(level="DEBUG")

ScreenShape = (1280, 720)
EdgeOffset = (2, 32)
ToolPosX = 20
ToolPosY = {
    "Home": 695, 
    "Back": 655,
    "Menu": 735,
    "Clear": 330,
}


ServerHost = "0.0.0.0"
ServerPort = 8080
ServerDebug = False

defaults = {
    "任务管理器": {
        "offsetX": 0,
        "offsetY": 0,
        "width": 1280,
        "height": 720,
    },
    "微信": {
        "offsetX": 0,
        "offsetY": 0,
        "width": 400,
        "height": 400,
    },
}
for name in ["FGO1", "FGO2", "FGO3", "碧蓝航线"]:
    defaults[name] = {
        "offsetX": 2,
        "offsetY": 32,
        "width": 1280,
        "height": 720,
    }

def get_default(key, name, default=None):
    return defaults.get(name, {}).get(key, default)
