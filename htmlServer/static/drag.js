(function ($, window, document, undefined) {

    function touchWrapper(originFunc) {
        function resultFunc(e) {
            return originFunc(e.originalEvent.changedTouches[0]);
        }
        return resultFunc;
    }
    var Drag = function (ele, opt) {
        this.$ele = ele, this.x = 0, this.y = 0,
            this.defaults = {
                parent: 'parent',
                handler: false,
                limitMinX: false,
                limitMaxX: true,
                limitMinY: true,
                limitMaxY: false,
                dragStart: function (x, y) { },
                dragEnd: function (x, y) { },
                dragMove: function (x, y) { }
            },
            this.options = $.extend({}, this.defaults, opt)
    }

    Drag.prototype = {
        run: function () {
            var $this = this;
            var element = this.$ele;
            var handler = this.options.handler;
            var parent = this.options.parent;
            var isDown = false;
            var fun = this.options;
            var X = 0, Y = 0, moveX, moveY;
            // element.find('*').not('img').mousedown(function (e) { e.stopPropagation(); });
            if (parent == 'parent') {
                parent = element.parent();
            } else {
                parent = element.parents(parent);
            }
            if (!handler) {
                handler = element;
            } else {
                handler = element.find(handler);
            }
            parent.css({ position: 'relative' });
            element.css({ position: 'absolute' });
            var boxWidth = 0, boxHeight = 0, sonWidth = 0, sonHeight = 0;
            initSize();
            $(window).resize(function () {
                initSize();
            });
            function initSize() {
                boxWidth = parent.outerWidth();
                boxHeight = parent.outerHeight();
                var rect = element[0].getBoundingClientRect()
                sonWidth = rect.width;
                sonHeight = rect.height;
                console.log("use parent", parent)
            }
            function onStart(e) {
                console.log("Drag start", e)
                isDown = true;
                X = e.pageX;
                Y = e.pageY;
                $this.x = element.position().left;
                $this.y = element.position().top;
                element.addClass('on');
                if (fun.dragStart) {
                    fun.dragStart(parseInt(element.css('left')), parseInt(element.css('top')));
                }
                return false;
            }
            handler.css({ cursor: 'move' }).bind({
                mousedown: onStart,
                touchstart: touchWrapper(onStart)
            })

            function onEnd(e) {
                if (!isDown) {
                    return;
                }
                console.log("Drag end", e)
                if (fun.dragEnd) {
                    fun.dragEnd(parseInt(element.css('left')), parseInt(element.css('top')));
                }
                element.removeClass('on');
                isDown = false;
            }
            $(document).bind({
                mouseup: onEnd,
                touchend: touchWrapper(onEnd)
            })
            function onMove(e) {
                if (!isDown) {
                    return;
                }
                console.log("Drag move", e)
                moveX = $this.x + e.pageX - X;
                moveY = $this.y + e.pageY - Y;
                if (fun.dragMove) {
                    fun.dragMove(parseInt(element.css('left')), parseInt(element.css('top')));
                }

                if (fun.limitMaxX && moveX > (boxWidth - sonWidth)) {
                    moveX = boxWidth - sonWidth;
                }
                if (fun.limitMinX && moveX < 0) {
                    moveX = 0;
                }
                if (fun.limitMaxY && moveY > (boxHeight - sonHeight)) {
                    moveY = boxHeight - sonHeight;
                }
                if (fun.limitMinY && moveY < 0) {
                    moveY = 0;
                }
                console.log(boxWidth, boxHeight)
                element.css({ left: moveX, top: moveY });
                console.log("Update css", { left: moveX, top: moveY })
            }
            $(document).bind({
                mousemove: onMove,
                touchmove: touchWrapper(onMove)
            })
        }
    }
    $.fn.setDrag = function (options) {
        var drag = new Drag(this, options);
        drag.run();
        console.log("Set Drag", this, options)
        return this;
    }
})(jQuery, window, document);