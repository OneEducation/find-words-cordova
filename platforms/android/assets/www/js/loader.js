requirejs.config({
    baseUrl: "lib",
    shim: {
        easel: {
            exports: "createjs"
        },
        tween: {
            deps: ['easel'],
            exports: 'TweenJS'
        },
        sound: {
            deps: ['easel'],
            exports: 'SoundJS'
        }
    },
    paths: {
        activity: "../js",
        easel: "../lib/easeljs-0.8.0.min",
        tween: "../lib/tweenjs-0.6.0.min",
        CSSPlugin: "../lib/CSSPlugin",
        sound: "../lib/soundjs-0.6.0.min",
        preload: "../lib/preloadjs-0.6.0.min",
        wordfind: "../js/wordfind",
        wordlist: "../js/wordlist",
        wordmatrix: "../js/wordmatrix",
        categories: "../js/categories_words"
    }
});

requirejs(["activity/activity"]);
