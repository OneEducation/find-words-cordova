define(function (require) {

    require("easel");
    require("tween");
    require("preload");
    require("sound");

    var soundLoaded = false;
    var onAndroid = /Android/i.test(navigator.userAgent);
    if (window.location.search.indexOf('onAndroid') > -1) {
        onAndroid = true;
    };

    var smallScreen = (window.innerWidth < 700) || (window.innerHeight < 600);

    console.log('WORDLIST onAndroid ' + onAndroid+ ' - ' + navigator.userAgent);
    var soundsPath = 'sounds/';
    var drips = ['water_drip', 'water_drip_007', 'water_drip_009'];
    var soundManifest = [
        {id:"water_drip", src: "water_drip.ogg"},
        {id:"water_drip_007", src: "water_drip_007.ogg"},
        {id:"water_drip_009", src: "water_drip_009.ogg"}];

    if (!onAndroid) {
        // load the sound
        createjs.Sound.alternateExtensions = ["mp3"];
        createjs.Sound.addEventListener("fileload", soundReady);
        createjs.Sound.registerManifest(soundManifest, soundsPath);
    };

    function soundReady(event) {
        console.log('Sound loaded!!!!!!!!!!');
        soundLoaded = true;
    };

    function playAudio(id) {
        var src = null;
        for (var i in soundManifest) {
            var mediaInfo = soundManifest[i];
            if (mediaInfo['id'] == id) {
                src = soundsPath + mediaInfo['src']
            }
        }
        if (src == null) {
            return;
        };

        if (onAndroid) {
            // Android needs the search path explicitly specified
            console.log("Using Phonegap media on Android");
            src = '/android_asset/www/' + src;
            // and use the mp3 files
            src = src.replace(".ogg", ".mp3");
            var mediaRes = new Media(src,
                function onSuccess() {
                    // release the media resource once finished playing
                    mediaRes.release();
                },
                function onError(e){
                    console.log("error playing sound: " + JSON.stringify(e));
                });
            mediaRes.play();
            return mediaRes;
        } else {
            return createjs.Sound.play(id);
        }
    }

    function playRandomDrip() {
        var r = Math.floor((Math.random() * drips.length));
        var drip = drips[r];
        playAudio(drip);
    };

    wordlist = {};

    var padding = smallScreen ? 6 : 10;
    var shadow_width = 10;

    function createAsyncBitmap(stage, url, callback) {
        // Async creation of bitmap from SVG data
        // Works with Chrome, Safari, Firefox (untested on IE)
        var img = new Image();
        img.onload = function () {
            bitmap = new createjs.Bitmap(img);
            bitmap.setBounds(0, 0, img.width, img.height);
            bitmap.mouseEnabled = false;
            callback(stage, bitmap);
        };
        img.src = url;
    };

    function createAsyncBitmapButton(stage, url, align, parentBound, callback) {
        var img = new Image();
        img.container = null;

        img.onload = function () {
            var bitmap = new createjs.Bitmap(img);
            bitmap.setBounds(0, 0, img.width, img.height);
            bitmap.mouseEnabled = false;
            bounds = bitmap.getBounds();
            var scale = (stage.canvas.height * 0.05) / bounds.height;
            bitmap.scaleX = scale;
            bitmap.scaleY = scale;

            if (this.container == null) {
                this.container = new createjs.Container();
                var margin = {
                    x: (parentBound.width / 3 - bounds.width * scale)/2,
                    y: (parentBound.height - bounds.height * scale)/2
                };

                var hitArea = new createjs.Shape();
                hitArea.graphics.beginFill("#000").drawRect(-margin.x, -margin.y, parentBound.width / 3, parentBound.height);
                this.container.hitArea = hitArea;
                this.container.addChild(bitmap);
                /*var background = new createjs.Shape();
                background.graphics.beginFill("#878787").drawRect(-margin.x, -margin.y,
                    parentBound.width / 3, parentBound.height);*/
                    
                this.container.y = parentBound.y + margin.y;
                if (align == 'left') {
                    this.container.x = parentBound.x + margin.x;
                } else if (align == 'center') {
                    this.container.x = parentBound.x + parentBound.width / 3 + margin.x;  
                } else if (align == 'right') {
                    this.container.x = parentBound.x + parentBound.width * 0.66 + margin.x;
                };

                stage.addChild(this.container);
                callback(this.container);
            } else {
                this.container.removeAllChildren();
                this.container.addChild(bitmap);
            };
        };
        img.src = url;
        return img;
    };

    function WordListView(canvas, game) {

        this.canvas = canvas;
        this.game = game;
        this.selectedWord = null;
        this.onAnimation = false;
        this.noMoreSpace = false;
        this.wordHeight = smallScreen ? 35 : 50;

        this.stage = new createjs.Stage(this.canvas);

        // fix for click event not firing consistantly
        var badAndroidDevice = navigator.userAgent.indexOf("Android") > -1 && !(navigator.userAgent.indexOf("Chrome") > -1);
        if (badAndroidDevice && createjs.Touch.isSupported()) {
            this.stage.enableDOMEvents(false);
            createjs.Touch.enable(this.stage);
        }
        
        this.stage.enableMouseOver(20);

        this.handleComplete = function (event) {
            var queue = event.target;
            this.deleteButton = new createjs.Container();
            var minus = queue.getResult("minus")

            this.deleteButtonImg = new createjs.Bitmap(minus);
            this.deleteButton.visible = false;
            this.deleteButton.addChild(this.deleteButtonImg);
            var hitArea = new createjs.Shape();
            var r = this.wordHeight / 2;
            hitArea.graphics.beginFill("#000").drawCircle(r, r, r);
            this.deleteButton.hitArea = hitArea;

            this.stage.addChild(this.deleteButton);

            this.deleteButton.on('click', this.deleteButtonCb, this);

        };

        queue = new createjs.LoadQueue(false);
        queue.on("complete", this.handleComplete, this);
        queue.loadFile({id:"minus", src:"icons/minus.png"});

        // createjs.Ticker.addEventListener("tick", this.stage);

        // add a background
        this.bgContainer = new createjs.Container();

        this.background = new createjs.Shape();
        this.background.graphics.beginFill(
            createjs.Graphics.getRGB(0x038a4dd)).drawRect(
            0, 0, this.canvas.width - shadow_width, this.canvas.height);
        this.stage.addChild(this.background);

        this.rightBorder = new createjs.Shape();
        this.rightBorder.graphics.beginLinearGradientFill(
            ["#aaaaaa", "#ffffff"], [0, 1],
            this.canvas.width - shadow_width, 0,
            this.canvas.width, 0).drawRect(
            this.canvas.width - shadow_width, 0,
            this.canvas.width, this.canvas.height);
        this.stage.addChild(this.rightBorder);

        createAsyncBitmap(this.stage, "./images/sidebar-cloud.svg",
            function(stage, bitmap) {
            bounds = bitmap.getBounds();
            var scale = (stage.canvas.width - shadow_width) / bounds.width;
            bitmap.scaleX = scale;
            bitmap.scaleY = scale;
            bitmap.x = 0;
            bitmap.y = 0;
            stage.addChildAt(bitmap, 1);

            var boundForChildren = {
                x : 0, y : 0,
                width : bounds.width * scale,
                height : bounds.height * scale * 0.7
            };

            if (onAndroid) {
                createAsyncBitmapButton(stage, "./images/arrow-black.svg", 'left',
                boundForChildren, function(button) {
                    button.on('click', function() {
                        createjs.Tween.removeAllTweens();
                        game.stop();
                        game.previousPage();
                    });
                });

                createAsyncBitmapButton(stage, "./images/uppercase-lowercase.svg",
                'center', boundForChildren, function(button) {
                    button.on('click', function() {
                        game.setLowerCase(!game.lowerCase);
                    });
                });

                var audioImgSrc = "./images/audio.svg";
                if (!game.audioEnabled) {
                    audioImgSrc = "./images/audio-no.svg";
                };

                audioImg = createAsyncBitmapButton(
                    stage, audioImgSrc, 'right', boundForChildren,
                    function(button) {
                        button.on('click', function() {
                            game.enableAudio(!game.audioEnabled);
                            if (game.audioEnabled) {
                                audioImg.src = "./images/audio.svg";
                            } else {
                                audioImg.src = "./images/audio-no.svg";
                            };
                        });
                    });
            };

        });

        createAsyncBitmap(this.stage, "./images/sidebar-hill.svg",
            function(stage, bitmap) {
            bounds = bitmap.getBounds();
            var scale = (stage.canvas.width - shadow_width) / bounds.width;
            bitmap.scaleX = scale;
            bitmap.scaleY = scale;
            bounds = bitmap.getBounds();
            bitmap.x = 0;
            bitmap.y = stage.canvas.height - bounds.height * scale; // fix vertical
                                                                 // position
            stage.addChildAt(bitmap, 1);
        });

        this.minimalSpace = this.wordHeight;
        if (onAndroid) {
            // on android we need more space, because the buttons are not in
            // the toolbar, but over the listview canvas
            this.minimalSpace = this.wordHeight * 2;
        }

        this.stage.on('click', function (event) {
            if (this.game.started) {
                return;
            };

            if (event.target == this.background) {
                this.deleteButton.visible = false;
                this.selectedWord = null;
            };
        }, this);

        this.deleteButtonCb = function (event) {
            function doneHandler() {
                
                animationDone++;
                console.log(this.wordElements.length + " / " + animationDone)
                if (this.wordElements.length === animationDone) {
                    createjs.Ticker.removeEventListener("tick", this.stage);
                    if (wordElementIndex > -1) {
                        this.wordElements.splice(wordElementIndex, 1);
                    };
                }
            };

            if (this.game.started) {
                return;
            };

            if (this.selectedWord != null) {
                createjs.Ticker.addEventListener("tick", this.stage);

                this.game.removeWord(this.selectedWord.word);

                createjs.Tween.get(this.selectedWord)
                .to({x: this.canvas.width}, 300, createjs.Ease.cubicIn)
                .call(function() {
                    this.stage.removeChild(this.selectedWord); 
                    this.selectedWord = null;
                    doneHandler.apply(this);
                }, [], this);
                
                this.deleteButton.visible = false;

                var found = false;
                // animate the pending blocks
                var delay = 100;
                var wordElementIndex = -1;
                var animationDone = 0;
                for (var n = 0; n < this.wordElements.length; n++) {
                    var textElement = this.wordElements[n];
                    if (textElement.text.toUpperCase() ==
                        this.selectedWord.word) {
                        found = true;
                        wordElementIndex = n;
                        continue;
                    }

                    if (found) {
                        var cont = textElement.parent;
                        var y_final_position = cont.y + this.wordHeight;
                        createjs.Tween.get(cont).wait(delay).to(
                            {y:y_final_position}, 1000,
                            createjs.Ease.bounceOut)
                            .call(doneHandler, [], this);
                        delay = delay + 100;
                    } else {
                        doneHandler.apply(this);
                    }
                };
                
                
                this.noMoreSpace = false;
            };
        };

        this.deleteAllWords = function () {
            for (var i = 0;i < this.wordElements.length; i++) {
                var textElement = this.wordElements[i];
                this.stage.removeChild(textElement.parent);
            };
            this.stage.update();
            this.wordElements = [];
            this.selectedWord = null;
            this.noMoreSpace = false;
            this.deleteButton.visible = false;
        };

        // the stage elements displaying every word in the word list
        this.wordElements = [];

        this.addWords = function (words) {
            if (words.length == 0) {
                this.onAnimation = false;
                return;
            };
            createjs.Tween.removeAllTweens();
            createjs.Ticker.addEventListener("tick", this.stage);
            this.onAnimation = true;

            var animationDone = 0;
            var delay = 0;
            for (var n = 0; n < words.length; n++) {
                var word = words[n];
                var cont = new createjs.Container();
                cont.x = smallScreen ? 10 : 20; // margin_x;
                cont.y = 0;
                cont.mouseChildren = false;
                cont.visible = false;

                var text = this.addRoundedLabel(cont, word);
                cont.word = word.toUpperCase();

                this.stage.addChild(cont);

                this.wordElements.push(text);

                var yFinalPosition = this.canvas.height - this.wordHeight * 
                    (this.wordElements.length);

                if (yFinalPosition < this.minimalSpace) {
                    this.noMoreSpace = true;
                }

                var game = this.game;
                createjs.Tween.get(cont).wait(delay).call(function() {
                        this.visible = true;
                        if (game.audioEnabled) {
                            playRandomDrip();
                        };
                    }).to({y:yFinalPosition}, 1300, createjs.Ease.bounceOut)
                    .call(function() {
                        ++animationDone;
                        if (words.length === animationDone) {
                            this.onAnimation = false;
                            createjs.Ticker.removeEventListener("tick", this.stage);        
                        }
                    }, [], this);
                delay = delay + 400;
            };
        };

        this.maxNumberOfWords = function() {
            return Math.round((this.canvas.height - this.minimalSpace) /
                              this.wordHeight);
        };

        this.addRoundedLabel = function(cont, word) {
            var label;
            if (this.game.lowerCase) {
                label = word.toLowerCase();
            } else {
                label = word.toUpperCase();
            };

            var alpha = 1.0;
            if (this.game.found.indexOf(word.toUpperCase()) > -1) {
                alpha = 0.25;
            };

            var font = smallScreen ? "16px VAG Rounded W01 Light" : "24px VAG Rounded W01 Light";
            var text = new createjs.Text(label, font, "#000000");
            text.x = text.getMeasuredWidth() / 2 + padding;
            text.y = padding;
            text.textAlign = "center";
            text.alpha = alpha;

            var width = text.getMeasuredWidth() + padding * 2;
            var height = text.getMeasuredHeight()+ padding * 2;

            var box = new createjs.Shape();
            box.graphics.beginFill(this.game.getWordColor(word, alpha)
                ).drawRoundRect(0, 0, width, height, 20);
            cont.addChild(box);
            cont.addChild(text);

            cont.cache(0, 0, width, height);
            cont.width = width; //text.getMeasuredWidth() + padding * 2;
            cont.height = height; //text.getMeasuredHeight()+ padding * 2;

            var hitArea = new createjs.Shape();
            hitArea.graphics.beginFill("#000").drawRect(0, 0,
                           width,
                           height);
            cont.hitArea = hitArea;

            cont.on('click', this.selectWordCb, this);
            //cont.on('rollover', this.selectWordCb, this);
            cont.on('mousedown', function(evt) {
                this.down_event = evt;
            });

            cont.on('pressup', function(evt) {
                if(evt.stageX - evt.target.down_event.stageX > this.canvas.width/3) {
                    this.selectedWord = evt.target;
                    this.deleteButtonCb();
                }
            }, this);

            return text;
        };

        this.selectWordCb = function (event) {
            // if the game already started or the words are falling,
            // do nothing
            if (this.game.started || this.onAnimation) {
                return;
            };

            if (event.target != this.selectedWord) {
                cont = event.target;
                this.selectedWord = cont;
                // set the position of deleteButton and make visible
                this.deleteButton.y = cont.y;
                this.deleteButton.x = cont.x + cont.width + padding;

                rect = this.deleteButtonImg.getBounds();
                scale = cont.height / rect.height;
                this.deleteButtonImg.scaleX = scale;
                this.deleteButtonImg.scaleY = scale;

                this.deleteButton.visible = true;

                this.stage.update();
            };
        };

        this.changeCase = function () {
            this.deleteButton.visible = false;
            this.updateAll();
        };

        this.updateWord = function (foundWord) {
            for (var i = 0; i < this.wordElements.length; i++) {
                var word = this.wordElements[i];
                if (word.text.toUpperCase() == foundWord) {
                    var cont = word.parent;
                    cont.removeAllChildren();
                    var text = this.addRoundedLabel(cont, foundWord);
                    // update the reference in wordList
                    this.wordElements[i] = text;
                    this.stage.update();
                    break;
                };
            };
        };

        this.updateAll = function () {
            for (var i = 0; i < this.wordElements.length; i++) {
                var word = this.wordElements[i];
                var text = word.text;
                var cont = word.parent;
                cont.removeAllChildren();
                // update the reference in wordList
                this.wordElements[i] = this.addRoundedLabel(cont, text, 1);
            };
            this.stage.update();
        };

        this.gameStarted = function() {
            this.deleteButton.visible = false;
        };

    };

    wordlist.View = WordListView;

    return wordlist;
});
