window.syncClockLed = function (led, now) {
    // Seek the running blink using the same time sample as the digits.
    const blink = led?.getAnimations().find(animation => animation.animationName === "led-second-blink");
    if (blink?.playState === "running") {
        blink.currentTime = now.getMilliseconds();
    }
};
