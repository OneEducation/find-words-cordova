define(function (require) {

    // to remove 300ms delay for click event on mobile
    var isTouch = !!('ontouchstart' in window);
    var clickEvent = isTouch ? 'touchend' : 'click';

    var activity = require("sugar-web/activity/activity");
    var icon = require("sugar-web/graphics/icon");

    var l10n = require("webL10n");

    function _(text) {
        // this function add a fallback for the case of translation not found
        // can be removed when we find how to read the localization.ini
        // file in the case of local html file opened in the browser
        translation = l10n.get(text);
        if (translation == '') {
            translation = text;
        };
        return translation;
    };

    var dictstore = require("sugar-web/dictstore");

    require("easel");
    require("wordfind");
    require("tween");
    require("CSSPlugin");
    require("wordlist");
    require("wordmatrix");

    var page = 0;
    var game = null;
    var onAndroid = /Android/i.test(navigator.userAgent);
    if (window.location.search.indexOf('onAndroid') > -1) {
        onAndroid = true;
    };
    var smallScreen = (window.innerWidth < 700) || (window.innerHeight < 600);

    var categories = null;
    var continueBtn;
    var upperLowerButton;

    // initialize canvas size
    var onXo = ((window.innerWidth == 1200) && (window.innerHeight >= 900));
    var sugarCellSize = 75;
    var sugarSubCellSize = 15;
    if (!onXo && !onAndroid) {
        sugarCellSize = 55;
        sugarSubCellSize = 11;
    };
    if (onAndroid) {
        // set to the size of the bottom bar
        sugarCellSize = 0;
    }

    function nextPage() {
        if (page == 0) {
            // intro
            showLoadPage();
        } else if (page == 1) {
            // load words
            showMatrixPage();
        } else if (page == 2) {
            // game
            return;
        }
    };

    function previousPage() {
        console.log('page ' + page);
        if (page == 0) {
            // intro
            if (onAndroid) {
                navigator.app.exitApp();
            };
        } else if (page == 1) {
            // load words
            if (onAndroid) {
                showIntroPage();
            };
        } else if (page == 2) {
            // game
            showLoadPage({direction: 'prev'});
        }
    };

    function showIntroPage() {
        //document.getElementById("canvas").style.backgroundColor = "#38a4dd";
        document.getElementById("intro").style.display = "block";
        //document.getElementById("game").style.display = "none";
        
        var game = document.getElementById("game");
        game.style.webkitTransform = "scale(0)";
        game.style.opacity = "0";

        page = 0;
    };

    function showLoadPage(options) {
        var options = options || {};
        //document.getElementById("canvas").style.backgroundColor = "white";    
        // document.getElementById("firstPage").style.display = "block";
        // document.getElementById("gameCanvas").style.display = "none";
        // document.getElementById("intro").style.display = "none";
        document.getElementById("game").style.display = "block";        

        hideError();
        var gameView = document.getElementById("game");
        var gameCanvas = document.getElementById("gameCanvas");
        var firstPage = document.getElementById("firstPage");
        var intro = document.getElementById("intro");
        if (options.direction === 'prev') {
            gameCanvas.style.opacity = 0;
            firstPage.style.opacity = 1; 
            gameCanvas.addEventListener("webkitTransitionEnd", function listener() {
                gameCanvas.style.display = 'none';
                firstPage.style.display = 'block';
                this.removeEventListener("webkitTransitionEnd", listener);
            });
            
        } else {
            if (options.mode === 'random') {
                document.getElementById("add-word-container").style.display = 'none';
                document.getElementById("random-button-container").style.display = 'block';
                document.getElementById("random-label").textContent = _("RandomiseWords");
            } else {
                document.getElementById("add-word-container").style.display = 'block';
                document.getElementById("random-button-container").style.display = 'none';
                document.getElementById("random-label").textContent = _("AddWord");
            }

            gameCanvas.style.opacity = 0;
            firstPage.style.opacity = 1; 
            gameCanvas.style.display = 'none';
            firstPage.style.display = 'block';

            gameView.style.webkitTransform = "scale(1)";
            gameView.style.opacity = 1;
            gameView.addEventListener("webkitTransitionEnd", function listener() {
                intro.style.display = "none";
                this.removeEventListener("webkitTransitionEnd", listener);
                options.callback && options.callback();
            });
        }
        page = 1;
    };

    function showMatrixPage() {
        //document.getElementById("canvas").style.backgroundColor = "white";
        document.getElementById("intro").style.display = "none";
        document.getElementById("game").style.display = "block";
        // document.getElementById("firstPage").style.display = "none";
        // document.getElementById("gameCanvas").style.display = "block";

        var gameCanvas = document.getElementById("gameCanvas");
        var firstPage = document.getElementById("firstPage");
        firstPage.style.opacity = 0;
        gameCanvas.style.opacity = 1;
        firstPage.addEventListener("webkitTransitionEnd", function listener() {
            this.style.display = 'none';
            gameCanvas.style.display = 'block';
            game.start();
            this.removeEventListener("webkitTransitionEnd", listener);
        });

        page = 2;
    };

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

    function createIntroButtons(text, alpha, y, stage) {
        // show a centered text with the parameters specified
        var container = new createjs.Container();
        var font = "50px VAG Rounded W01 Light";
        if (smallScreen) {
            font = "32px VAG Rounded W01 Light";
        };
        var text = new createjs.Text(text, font, "#ffffff");
        text.alpha = alpha;
        text.name = 'text';
        container.x = (stage.canvas.width - text.getMeasuredWidth()) / 2;
        container.y = stage.canvas.height - (text.getMeasuredHeight() + 10) * y - 10;
        var hitArea = new createjs.Shape();
        hitArea.graphics.beginFill("#000").drawRect(0, 0,
            text.getMeasuredWidth(),
            text.getMeasuredHeight());
        container.hitArea = hitArea;
        container.addChild(text);
        stage.addChild(container);
        return container;
    };

    function enableContinueBtn() {
        // change the alpha on the continue btn in th intro
        // to show is enable the event. Can be called two times
        // depending on what finished first, creating the intro
        // or read the storage
        if (continueBtn == null) {
            // the btn was nocreated yet
            return;
        };
        if (continueBtn.getChildByName('text').alpha == 1) {
            // the btn is already enabled
            return;
        };

        var wordList = [];
        if (onAndroid) {
            // on android we don load the list in the game
            // until after the intro screen
            var jsonData = localStorage["word-list"];
            if (jsonData != undefined) {
                wordList = JSON.parse(jsonData);
            };
        } else {
            wordList = game.words;
        };

        if (game == null || wordList.length == 0) {
            return;
        };
        continueBtn.getChildByName('text').alpha = 1;
        continueBtn.getStage().update();

        continueBtn.on('click', function (e) {
            console.log('Continue clicked');
            var jsonData = localStorage["word-list"];
            var wordList = JSON.parse(jsonData);
            game.addWords(wordList);
            hideIntro();
        });
    };

    function addRandomWords() {
        if (game.started) {
            return;
        };

        game.removeAllWords();
        if (categories == null) {
            categories = require("categories");
        };
        var categoryNames = ['actions', 'adjectives', 'animals',
            'bodyparts', 'clothes', 'colors', 'constructions',
            'emotions', 'food', 'fruits', 'furnitures',
            'houseware', 'jobs', 'nature', 'objects', 'people',
            'plants', 'sports', 'transports', 'tools', 'vegetables'];

        var randomCategory = categoryNames[Math.floor(Math.random() *
                                           categoryNames.length)];

        var words = categories[randomCategory].slice(0);
        var cant = game.wordListView.maxNumberOfWords();
        var wordList = [];
        for (var n = 0; n < cant; n++) {
            if (words.length > 0) {
                var pos = Math.floor(Math.random() * words.length);
                var randomWord = words.splice(pos, 1)[0];
                if (randomWord.indexOf('_') > -1) {
                    randomWord = randomWord.substring(0,
                        randomWord.indexOf('_'));
                };
                if (randomWord.length > 2) {
                    wordList.push(randomWord.toUpperCase());
                };
            };
        };
        game.addWords(wordList);
        // save in the journal
        localStorage["word-list"] = JSON.stringify(game.words);
        dictstore.save();
    };

    function showIntro() {
        var introCanvas = document.getElementById("introCanvas");
        introCanvas.height = window.innerHeight;
        introCanvas.width = window.innerWidth;
        console.log('canvas size ' + introCanvas.width + ' x ' +
            introCanvas.height);
        var introStage = new createjs.Stage(introCanvas);

        createAsyncBitmap(introStage, "./images/big-letter-clouds.svg",
            function(stage, cloudBitmap) {
            bounds = cloudBitmap.getBounds();
            var scale = introCanvas.width / bounds.width;
            cloudBitmap.scaleX = scale;
            cloudBitmap.scaleY = scale;
            bounds = cloudBitmap.getBounds();
            cloudBitmap.x = 0;
            cloudBitmap.y = introCanvas.height * 0.7;
            //stage.addChild(cloudBitmap);

            createAsyncBitmap(stage, "./images/hills.svg",
                              function(stage, hillsBitmap) {
                bounds = hillsBitmap.getBounds();
                var scale = introCanvas.width / bounds.width;
                hillsBitmap.scaleX = scale;
                hillsBitmap.scaleY = scale;
                hillsBitmap.x = 0;
                hillsBitmap.y = introCanvas.height - bounds.height * scale;

                //stage.addChild(hillsBitmap);

                createAsyncBitmap(stage, "./images/logo.svg",
                                  function(stage, logoBitmap) {
                    bounds = logoBitmap.getBounds();
                    scale = introCanvas.width * 0.52 / bounds.width;
                    console.log('LOGO SCALE ' + scale)
                    logoBitmap.scaleX = scale;
                    logoBitmap.scaleY = scale;
                    logoBitmap.x = (introCanvas.width - (bounds.width * scale)) / 2;
                    logoBitmap.y = introCanvas.height * 0.12;
                    logoBitmap.alpha = 0;
                    
                    stage.addChild(cloudBitmap);
                    stage.addChild(hillsBitmap);
                    stage.addChild(logoBitmap);

                    continueBtn = createIntroButtons(_('Continue'), 0.2, 3, introStage);
                    enableContinueBtn();

                    var newGameBtn = createIntroButtons(_('NewGame'), 1, 2, introStage);

                    newGameBtn.on('click', function (e) {
                        game.removeAllWords();
                        hideIntro();
                    });

                    var randomGame = createIntroButtons(_('RandomGame'), 1, 1, introStage);
                    randomGame.on('click', function (e) {
                        game.removeAllWords();
                        showLoadPage({
                            mode: 'random',
                            callback: addRandomWords
                        });
                    });
                    stage.update();
                    createjs.Ticker.addEventListener("tick", stage);

                    createjs.Tween.get(cloudBitmap)
                    .wait(300)
                    .to({y: introCanvas.height * 0.34}, 1000, createjs.Ease.easeIn)
                    .wait(200)
                    .call(function() {
                        createjs.Tween.get(logoBitmap)
                        .to({alpha: 1}, 1000)
                        .call(function() {
                            createjs.Ticker.removeEventListener("tick", stage);
                            
                            var oeLogo = document.getElementById("oe-logo");
                            var oeLogoLayer = document.getElementById("oe-logo-layer");
                            var oeCredit = document.getElementById("oe-credit");

                            oeLogoLayer.style.display = 'block';
                            oeLogo.style.webkitAnimation = 'blink 3s ease-in-out 0s infinite';
                            oeLogo.addEventListener(clickEvent, function() {
                                if (this.style.webkitAnimation) {
                                    this.style.webkitAnimation = '';
                                    oeCredit.style.opacity = 1;    
                                } else {
                                    this.style.webkitAnimation = 'blink 3s ease-in-out 0s infinite';
                                    oeCredit.style.opacity = 0;
                                }
                            });
                        });    
                    });
                });
            });
        });
    };

    function createWinButton(text, color, size, y, stage) {
        // show a centered text with the parameters specified
        var container = new createjs.Container();

        if (smallScreen) {
            size = size / 2;
        };

        var text = new createjs.Text(text, size + "px VAG Rounded W01 Light", "#ffffff");
        text.name = 'text';
        container.x = (stage.canvas.width - text.getMeasuredWidth())
                               / 2;
        container.y = y;
        var background = new createjs.Shape();
        background.graphics.beginFill(color).drawRoundRect(-10, -10,
            text.getMeasuredWidth() + 20, text.getMeasuredHeight() + 20, 10);

        var hitArea = new createjs.Shape();
        hitArea.graphics.beginFill("#000").drawRect(0, 0,
            text.getMeasuredWidth(),
            text.getMeasuredHeight());
        container.hitArea = hitArea;
        container.addChild(background);
        container.addChild(text);
        stage.addChild(container);
        return container;
    };

    function showWin(game) {
        //change to the first page
        showIntroPage();
        page = 0;

        document.getElementById("oe-logo-layer").style.display = "none";
        var introCanvas = document.getElementById("introCanvas");
        introCanvas.height = window.innerHeight;
        introCanvas.width = window.innerWidth;
        console.log('canvas size ' + introCanvas.width + ' x ' +
            introCanvas.height);
        var introStage = new createjs.Stage(introCanvas);

        createAsyncBitmap(introStage, "./images/win-screen-cloud.svg",
            function(stage, bitmap) {
            bitmap.x = 0;
            bitmap.y = 0;
            bounds = bitmap.getBounds();
            scale = introCanvas.width * 0.5 / bounds.width;
            bitmap.scaleX = scale;
            bitmap.scaleY = scale;
            stage.addChild(bitmap);

            createAsyncBitmap(stage, "./images/hills.svg",
                              function(stage, bitmap) {
                bounds = bitmap.getBounds();
                var scale = introCanvas.width / bounds.width;
                bitmap.scaleX = scale;
                bitmap.scaleY = scale;
                bitmap.x = 0;
                bitmap.y = introCanvas.height - bounds.height * scale / 2;
                stage.addChild(bitmap);

                createAsyncBitmap(stage, "./images/trophy.svg",
                                  function(stage, bitmap) {
                    var y = introCanvas.height * 0.06;
                    bounds = bitmap.getBounds();
                    scale = introCanvas.height * 0.2 / bounds.height;
                    console.log('TROPY SCALE ' + scale)
                    bitmap.scaleX = scale;
                    bitmap.scaleY = scale;
                    bitmap.x = (introCanvas.width - (bounds.width * scale)) / 2;
                    bitmap.y = y;
                    stage.addChild(bitmap);
                    y = y + bounds.height * scale + 15;

                    var font = smallScreen ? "45px VAG Rounded W01 Light" : "85px VAG Rounded W01 Light";
                    var text = new createjs.Text(_('YouWin!'), font,
                                                 "#ffffff");
                    text.x = (introCanvas.width - text.getMeasuredWidth()) / 2;
                    text.y = y;
                    stage.addChild(text);
                    y = y + text.getMeasuredHeight() + 10;

                    // format the time
                    minutes = Math.floor(game.elapsedTime / 60);
                    seconds = Math.floor(game.elapsedTime - minutes * 60);
                    var time = seconds + 's';
                    if (minutes > 0) {
                        time = minutes + 'm ' + seconds + 's';
                    };

                    font = smallScreen ? "32px VAG Rounded W01 Light" : "65px VAG Rounded W01 Light";
                    var text = new createjs.Text(time, "65px VAG Rounded W01 Light",
                                                 "#ffffff");
                    text.x = (introCanvas.width - text.getMeasuredWidth()) / 2;
                    text.y = y;
                    stage.addChild(text);

                    y = y + text.getMeasuredHeight() + (smallScreen ? 20 : 40);


                    var newGameBtn = createWinButton(_('NewGame'),
                        '#80ba27', 50, y, introStage);

                    y = y +  (smallScreen ? 60 : 90);

                    var randomGameBtn = createWinButton(_('RandomGame'),
                        '#72a624', 40, y, introStage);

                    newGameBtn.on('click', function (e) {
                        game.removeAllWords();
                        showLoadPage();
                    });

                    randomGameBtn.on('click', function (e) {
                        //addRandomWords();
                        game.removeAllWords();
                        showLoadPage({
                            mode: 'random',
                            callback: addRandomWords
                        });
                    });

                    stage.update();
                });
            });
        });
    };

    function hideIntro() {
        nextPage();
    };

    document.addEventListener("deviceready", function () {
        console.log('deviceready EVENT');
        document.addEventListener("backbutton", function () {
            console.log('backbutton EVENT');
            previousPage();
            game.stop();
        }, false);
    }, false);

    function initColors() {
        return ['#e51c23', '#e91e63', '#9c27b0', '#673ab7',
               '#3f51b5', '#5677fc', '#03a9f4', '#00bcd4',
               '#009688', '#259b24', '#8bc34a', '#cddc39',
               '#ffc107', '#ff9800', '#ff5722'];
    };


    function Game(wordListCanvas, gameCanvas, startGameButton) {

        this.words = [];
        this.level = 'easy';
        this.found = [];
        this.started = false;
        this.lowerCase = false;
        this.audioEnabled = true;
        this.colors = initColors();
        this.previousPage = previousPage;

        this.wordListView = new wordlist.View(wordListCanvas, this);
        this.matrixView = new wordmatrix.View(gameCanvas, this);
        this.startGameButton = startGameButton;
        this.wordColors = {};

        this.setLowerCase = function (lowerCase) {
            this.lowerCase = lowerCase;
            this.wordListView.changeCase();
            if (this.started) {
                // change the matrix
                this.matrixView.changeCase();
            };
        };

        this.addWords = function (words) {
            console.log('addWords ' + words.toString());
            var wordsAdded = [];
            for (var n = 0; n < words.length; n++) {
                if (this.words.indexOf(words[n]) == -1) {
                    this.words.push(words[n]);
                    wordsAdded.push(words[n]);
                };
            };
            this.wordListView.addWords(wordsAdded);
            this.startGameButton.disabled = (this.words.length == 0);
            // save in the journal
            localStorage["word-list"] = JSON.stringify(this.words);
            dictstore.save();
            enableContinueBtn();
        };

        this.addFoundWord = function (word) {
            // return true if the game finished
            this.found.push(word);
            this.wordListView.updateWord(word);
            // check if the game finished
            if (this.words.length == this.found.length) {
                console.log('game.finished!!!!!!');
                this.elapsedTime = (new Date().getTime() - this.initTime) / 1000;
                // delay show the end window until the end of the sound
                var game = this;
                setTimeout(function() {showWin(game);}, 2500);
                this.stop();
                return true;
            };
            return false;
        };

        this.restartWordList = function() {
            this.wordListView.updateAll();
        };

        this.getWordColor = function(word, alpha) {
            var word = word.toUpperCase();
            var hexaColor = "#cccccc";
            if (word in this.wordColors) {
                hexaColor = this.wordColors[word];
            } else {
                if (this.colors.length > 0) {
                    hexaColor = this.colors.pop();
                    this.wordColors[word] = hexaColor;
                };
            };

            r = parseInt(hexaColor.substr(1, 2), 16);
            g = parseInt(hexaColor.substr(3, 2), 16);
            b = parseInt(hexaColor.substr(5, 2), 16);
            return createjs.Graphics.getRGB(r, g, b, alpha);
        };

        this.start = function() {
            this.started = true;
            this.wordListView.gameStarted();
            this.matrixView.init();
            this.initTime = new Date().getTime();
        };

        this.stop = function() {
            this.started = false;
            // stop the animation
            this.matrixView.stop();
            this.found = [];
            this.restartWordList();
        };

        this.removeWord = function(word) {
            var word = word.toUpperCase();
            if (this.words.indexOf(word) > -1) {
                this.words.splice(this.words.indexOf(word), 1);
                localStorage["word-list"] = JSON.stringify(this.words);
                dictstore.save();
                // free the color
                this.colors.push(this.wordColors[word]);
                delete this.wordColors[word];
            };
            if (this.words.length == 0) {
                this.startGameButton.disabled = true;
            };
        };

        this.removeAllWords = function() {
            this.colors = initColors();
            this.words = [];
            localStorage["word-list"] = JSON.stringify(this.words);
            dictstore.save();
            this.wordListView.deleteAllWords();
            this.startGameButton.disabled = true;
        };

        this.enableAudio = function (enable) {
            this.audioEnabled = enable;
        };

    };

    function findPosition(obj) {
        var left = 0;
        var top = 0;
        if (obj.offsetParent) {
            while(1) {
                left += obj.offsetLeft;
                top += obj.offsetTop;
                if(!obj.offsetParent)
                    break;
                obj = obj.offsetParent;
            };
        } else if(obj.x) {
            left += obj.x;
            top += obj.y;
        };
        return {left:left, top: top};
    };

    function validateWord(word) {
        // not allow input special characters, number or spaces in the words
        var iChars = "0123456789!¡~@#$%^&*()+=-[]\\\';,./{}|\":<>?¿ ";
        if (word.length < 3) {
            showError(_('MinimumLetters'));
            return false;
        };
        for (var i = 0; i < word.length; i++) {
            if (iChars.indexOf(word.charAt(i)) > -1) {
                showError(_('RemovePunctuation'));
                return false;
            };
        };
        if (game.wordListView.noMoreSpace) {
            showError(_('NoMoreWords'));
            return false;
        }
        hideError();
        return true;
    };

    function showError(msg) {
        var errorArea = document.getElementById("validation-error");
        var addWordButton = document.getElementById("add-word-button");
        var buttonPos = findPosition(addWordButton);
        errorArea.innerHTML = '<div id="validation-error-msg">' + msg +
            '</div>';
        errorArea.style.left = (buttonPos.left +
                                addWordButton.offsetWidth / 2 - 20)
                                + 'px';
        var top = buttonPos.top;
        if (onAndroid) {
            top = buttonPos.top + addWordButton.offsetHeight;
        } else {
            // HACK: this number don't have sense, but set the right position
            top = buttonPos.top + 25;
        };
        errorArea.style.top = top + 'px';
        errorArea.style.opacity = "0.1";
        errorArea.style.display = "block";

        createjs.Tween.get(errorArea).set({opacity:"1.0"},
                           errorArea.style, 3000);
    };

    function hideError() {
        var errorArea = document.getElementById("validation-error");
        errorArea.style.display = "none";
    };

    function getButton(level) {
        var button;
        if (level == 'easy') {
            console.log('LEVEL EASY');
            button = document.getElementById("easy-button");
        } else if (level == 'medium') {
            console.log('LEVEL MEDIUM');
            button = document.getElementById("medium-button");
        } else if (level == 'hard') {
            console.log('LEVEL HARD');
            button = document.getElementById("hard-button");
        };
        return button;
    }

    function setLevel(level, options) {
        options = options || {};
        console.log('setLevel ' + game.level + ' new level ' + level);
        var originalButton = getButton(game.level);
        var button = getButton(level);
        game.level = level;

        if (localStorage["level"] != level) {
            localStorage["level"] = level;
            dictstore.save();
        };

        var initSize = smallScreen ? 60 : sugarSubCellSize * 7;

        console.log('button ' + button + ' width ' + initSize);



        if (options.state === 'init') {
            button.style.webkitTransform = 'scale(1.3)';
        } else {
            button.addEventListener("webkitAnimationEnd", function handler() {
                this.style.webkitTransform = 'scale(1.3)';
                this.style.webkitAnimation = '';
                this.removeEventListener(handler);
            },false);
            button.style.webkitAnimation = 'button-select 0.5s linear';

            if (button !== originalButton) {
                originalButton.addEventListener("webkitAnimationEnd", function handler() {
                    this.style.webkitTransform = '';
                    this.style.webkitAnimation = '';
                    this.removeEventListener(handler);
                },false);
                originalButton.style.webkitAnimation = 'button-deselect 0.1s linear';
            }
        }
    };

    // Manipulate the DOM only when it is ready.
    require(['domReady!'], function (doc) {
        var wordListCanvas = document.getElementById("wordListCanvas");
        var gameCanvas = document.getElementById("gameCanvas");
        var startGameButton = document.getElementById("start-game-button");
        upperLowerButton = document.getElementById("upperlower-button");
        var backButton = document.getElementById("back-button");
        var audioButton = document.getElementById("audio-button");
        var randomButton = document.getElementById("random-words-button");
        var wordInput = document.getElementById("word-input");
        var addWordButton = document.getElementById("add-word-button");
        var easyButton = document.getElementById("easy-button");
        var mediumButton = document.getElementById("medium-button");
        var hardButton = document.getElementById("hard-button");

        // Initialize the activity.
        (function giveHTMLButtonSelectEffect() {
            var elems = Array.prototype.slice.call(arguments);
            console.log(elems);
            elems.forEach(function(elem) {
                elem.addEventListener(clickEvent, function() {
                    this.style.webkitAnimation = "button-click 0.4s linear";
                });
                
                elem.addEventListener('webkitAnimationEnd', function() {
                    this.style.webkitAnimation = "";
                });
            });
        })(randomButton, addWordButton);
        
        console.log(navigator.userAgent);

        if (onAndroid) {
            showIntro();
            console.log('ON ANDROID, hide toolbar and move the canvas');
            // move the toolbar at the top
            var canvas = document.getElementById("canvas");
            canvas.style.top = "0px";
        } else {
            // show the sugar toolbar
            var toolbar = document.getElementById("main-toolbar");
            toolbar.style.display = "block";
            hideIntro();
        };

        activity.setup();

        // HERE GO YOUR CODE

        wordListCanvas.height = window.innerHeight - sugarCellSize;
        wordListCanvas.width = window.innerWidth / 3;

        gameCanvas.height = window.innerHeight - sugarCellSize;
        var availableWidth = Math.min(window.innerWidth / 3 * 2,
                                      gameCanvas.height);
        // the matrix have 12 cells and a padding equeal to half a cell
        gameCanvas.width = availableWidth / 13 * 12;

        game = new Game(wordListCanvas, gameCanvas, startGameButton);

        // toolbar
        upperLowerButton.onclick = function () {
            this.classList.toggle('active');
            var lowercase = this.classList.contains('active');
            game.setLowerCase(lowercase);
        };

        backButton.addEventListener(clickEvent, function (e) {
            previousPage();
            game.stop();
        });

        randomButton.addEventListener(clickEvent, addRandomWords);

        // datastore
        var wordList = [];

        function onStoreReady() {
            if (localStorage["word-list"]) {
                var jsonData = localStorage["word-list"];
                var wordList = JSON.parse(jsonData);
                console.log('onStoreReady ' + jsonData);
                if (!onAndroid) {
                    // in android we show a intro screen do not load the words
                    game.addWords(wordList);
                };
                enableContinueBtn();
            };
            if (localStorage["level"]) {
                setLevel(localStorage["level"], {state: 'init'});
            } else {
                setLevel('easy', {state: 'init'});
            };

            if (localStorage["audio-enabled"]) {
                game.enableAudio(localStorage["audio-enabled"] == 'true');
                if (!game.audioEnabled){
                    audioButton.classList.toggle('active');
                };
            };

        };

        dictstore.init(onStoreReady);

        startGameButton.addEventListener('click', function (e) {
            nextPage();
            hideError();
        });

        createjs.CSSPlugin.install(createjs.Tween);
        createjs.Ticker.setFPS(20);

        addWordButton.addEventListener(clickEvent, function (e) {
            addWord();
        });

        wordInput.addEventListener('keypress', function (e) {
            hideError();
            if (e.which == 13) {
                addWord();
            };
        });

        function addWord() {
            if (!validateWord(wordInput.value)) {
                return;
            };
            game.addWords([wordInput.value.toUpperCase()]);
            wordInput.value = '';
            wordInput.focus();
        };

        // level buttons
        easyButton.addEventListener(clickEvent, function (e) {
            setLevel('easy');
        });

        mediumButton.addEventListener(clickEvent, function (e) {
            setLevel('medium');
        });

        hardButton.addEventListener(clickEvent, function (e) {
            setLevel('hard');
        });

    });

});
