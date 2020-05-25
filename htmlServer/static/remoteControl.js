(function ($, window, document, undefined) {

    function touchWrapper(originFunc) {
        function resultFunc(e) {
            return originFunc(e.originalEvent.changedTouches[0]);
        }
        return resultFunc;
    }
    var Control = function (ele, opt) {
        this.$ele = ele, this.x = 0, this.y = 0,
            this.defaults = {
                parent: 'parent',
                moveHandler: false,
                resizeTarget: ".video",
                resizeHandler: {
                    right: null,
                    bottom: null,
                },
                moveLimit: {
                    minX: false,
                    minY: true,
                    maxX: true,
                    maxY: false,
                },
                moveAxis: {
                    x: true,
                    y: true,
                },
                sizeLimit: {
                    minX: 320,
                    minY: 180,
                    maxX: 1920,
                    maxY: 1080,
                },
                onResize: function (scale){}
            },
            this.options = $.extend({}, this.defaults, opt)
    }

    Control.prototype = {
        run: function () {
            var $this = this;
            var element = this.$ele;
            var opt = this.options;
            var moveHandler = this.options.moveHandler, resizeHandler = this.options.resizeHandler;
            var parent = this.options.parent;
            var moveLimit = this.options.moveLimit;
            var isMoving = false, isResize = false;
            var X = 0, Y = 0, scale = 1, border = 0, moveX, moveY;
            // element.find('*').not('img').mousedown(function (e) { e.stopPropagation(); });
            if (parent == 'parent') {
                parent = element.parent();
            } else {
                parent = element.parents(parent);
            }
            if (!moveHandler) {
                moveHandler = element;
            } else {
                moveHandler = element.find(moveHandler);
            }
            parent.css({ position: 'relative' });
            element.css({ position: 'absolute' });
            var boxWidth = 0, boxHeight = 0;
            var rect = element[0].getBoundingClientRect();
            function initSize() {
                boxWidth = parent.outerWidth();
                boxHeight = parent.outerHeight();
                console.log("use parent", parent)
            }
            initSize();
            $(window).resize(function () {
                initSize();
            });
            
            if(opt.init){
                var target = opt.resizeTarget ? element.find(opt.resizeTarget) : element;
                console.log("InitSize", target, opt.init);
                target.css(opt.init);
                if(opt.onResize){
                    opt.onResize(opt.init);
                }
            }

            function moveStart(e) {
                console.log("Drag start", e)
                isMoving = true;
                X = e.pageX;
                Y = e.pageY;
                $this.x = element.position().left;
                $this.y = element.position().top;
                return false;
            }
            moveHandler.css({ cursor: 'move' }).bind({
                mousedown: moveStart,
                touchstart: touchWrapper(moveStart)
            })
            function resizeStart(e) {
                X = e.pageX;
                Y = e.pageY;
                $this.x = element.position().left;
                $this.y = element.position().top;
                return false;
            }
            function resizeRightStart(e) {
                isResize = "right";
                border = $(e.target).width() / 2;
                console.log("Resize right start", e, "border=", border)
                return resizeStart(e);
            }
            function resizeBottomStart(e) {
                isResize = "bottom";
                border = $(e.target).height() / 2;
                console.log("Resize bottom start", e, "border=", border)
                return resizeStart(e);
            }
            if (resizeHandler.right) {
                // console.log("resizeHandler.right", element.find(resizeHandler.right))
                element.find(resizeHandler.right).css({ cursor: 'e-resize' }).bind({
                    mousedown: resizeRightStart,
                    touchstart: touchWrapper(resizeRightStart)
                })
            }
            if (resizeHandler.bottom) {
                element.find(resizeHandler.bottom).css({ cursor: 's-resize' }).bind({
                    mousedown: resizeBottomStart,
                    touchstart: touchWrapper(resizeBottomStart)
                })
            }

            function moveEnd(e) {
                if (isMoving) {
                    console.log("Drag end", e)
                    isMoving = false;
                }
                if (isResize) {
                    console.log("Resize end", e)
                    isResize = false;
                }
            }
            $(document).bind({
                mouseup: moveEnd,
                touchend: touchWrapper(moveEnd)
            })
            function MoveProgress(e) {
                if (isMoving) {
                    rect = element[0].getBoundingClientRect();
                    // console.log("Drag move", e)
                    if (opt.moveAxis.x) {
                        moveX = $this.x + e.pageX - X;
                        if (moveLimit.maxX && moveX > (boxWidth - rect.width)) {
                            moveX = boxWidth - rect.width;
                        }
                        if (moveLimit.minX && moveX < 0) {
                            moveX = 0;
                        }
                        element.css({ left: moveX });
                    }
                    if (opt.moveAxis.y) {
                        moveY = $this.y + e.pageY - Y;
                        if (moveLimit.maxY && moveY > (boxHeight - rect.height)) {
                            moveY = boxHeight - rect.height;
                        }
                        if (moveLimit.minY && moveY < 0) {
                            moveY = 0;
                        }
                        element.css({ top: moveY });
                    }
                } else if (isResize) {
                    rect = element[0].getBoundingClientRect();
                    console.log("Resize", e)
                    if (isResize === "right") {
                        width = e.pageX - rect.x;
                        width = Math.max(width, opt.sizeLimit.minX);
                        width = Math.min(width, opt.sizeLimit.maxX);
                        height = width * 720 / 1280;
                        // console.log(`scale = ${e.pageX} - ${rect.x} / (${element.width()} - ${border}) = ${scale}`)
                    } else {
                        height = e.pageY - rect.y;
                        height = Math.max(height, opt.sizeLimit.minY);
                        height = Math.min(height, opt.sizeLimit.maxY);
                        width = height * 1280 / 720;
                        // console.log(`scale = ${e.pageY} - ${rect.y} / (${element.height()} - ${border}) = ${scale}`)
                    }
                    var newcss = { width: width, height: height };
                    var target = opt.resizeTarget ? element.find(opt.resizeTarget) : element;
                    console.log("Resize", target, newcss);
                    target.css(newcss);
                    // var r = target[0].getBoundingClientRect();
                    // target.parent().css({width: r.width, height: r.height})
                    if(opt.onResize){
                        opt.onResize(newcss);
                    }
                }
            }
            $(document).bind({
                mousemove: MoveProgress,
                touchmove: touchWrapper(MoveProgress)
            })
        }
    }
    $.fn.initControl = function (options) {
        console.log("init Control", this, options)
        var control = new Control(this, options);
        control.run();
        return this;
    }
})(jQuery, window, document);