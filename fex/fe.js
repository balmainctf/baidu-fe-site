Function.prototype.bind = function(context) {
    var _this = this;
    return function() {
        return _this.apply(context, arguments);
    }
}

function Event() {
    this._event = {};
    this.on = function ( name, callback ) {            
        var callbacks = this._event[name] = this._event[name] || baidu.Callbacks();
        callbacks.add(callback);
        return this;
    };
    this.off = function( name, callback ) {                 
        var callbacks = this._event[name] = this._event[name] || baidu.Callbacks();
        callbacks.remove(callback);
        return this;
    }
    this.fire = function( name, args ) {
        if(!this._event[name]) return;
        //console.log(this, name, args);
        this._event[name].fireWith( this, args );
        return this;
    };
}

function plan( fn, delay, args, context ) {
    var timer = setTimeout(function(){
        fn.apply(context, args);
    }, delay);
    return {
        cancel: function() { 
            clearTimeout(timer);
        }
    }
}

function Screen( index, stage, dom ) {
    Event.apply(this);
    this.index = index;
    this.name = dom.id;
    this.stage = stage;
    this.dom = dom;
    this.$ = baidu(this.dom);
}
Screen.prototype.fit = function( selector, type ) {
    var elem = this.$.find(selector);
    var stage = this.stage;
    var max = Math.max, min = Math.min;
    function onresize() {
        var cw = stage.width(), ch = stage.height(),
            w = elem.width(), h = elem.height(), 
            scale = {
                all: Math.max(ch / h, cw / w),
                height: ch / h,
                width: cw / w   
            }[type || 'all']; 
        elem.cssAnimate({scale: scale});
    };
    var last_timer;
    baidu(window).on('resize', function(){
        clearTimeout(last_timer);
        last_timer = setTimeout(onresize, 300);
    });
    this.on('beforeshow', onresize);
    onresize();
    return elem;
}
function Stage() {  
    Event.apply(this); 

    var   screens
        , disabled
        , slider
        , that
        , duration
        , hashPart;

    screens = baidu('.screen').map( function ( index, dom ) {
                return new Screen( index, this, dom );
            }.bind(this));
    disabled = false;
    duration = 1000;
    slider = new SlideShow({
        container: '#stage',
        direction: 'Y',
        duration: duration,
        effect: 'fold'
    });
    that = this;

    function updateHash() {
        if( disabled ) return;
        var hash = window.location.hash.substr(1);
        hashPart = hash.split('-');
    }

    function takeControl() {
        var last_wheel_event = 0; // Mac 下一次滚动触发多个滚动事件
        // change event by wheel
        baidu( 'body' ).on( 'mousewheel', function(e) {
            if( disabled ) return;
            if ( e.timeStamp - last_wheel_event < 200 ) {
                last_wheel_event = e.timeStamp;
                return;
            }
            last_wheel_event = e.timeStamp;
            e.wheelDelta < 0 ? slider.next() : slider.prev();
        });
        window.addEventListener('hashchange', function(){
            updateHash();
            var screen = that.getScreen(hashPart[0]);
            if ( screen ) {
                slider.slide( screen.index );
            }
        });

        function navigateBy( dir, source ) {
            var stoped = false;
            var e = { direction: dir, stopPropagation: function(){ stoped = true; }, source: source };
            that.getCurrentScreen().fire( 'navigate', [e] );
            if( stoped || disabled ) return;
            switch(dir) {
                case "Up":
                    slider.prev();
                    break;
                case "Down":
                    slider.next();
                    break;
            }
        }

        // keyboard navigate
        baidu( 'body' ).on( 'keydown', function(e) {
            navigateBy(e.keyIdentifier, 'keyboard');
        });

        // document.body.style.height = '1000px';
        // document.body.addEventListener( 'scroll', function(e) {
        //     if(this.scrollTop == 0) this.scrollTop = 1;
        // });
        // document.body.scrollTop = 1;

        var tsx, tsy;

        document.body.addEventListener( 'touchmove', function(e) {
            e.preventDefault();
        });
        document.body.addEventListener( 'touchstart', function(e) {
            if (e.touches.length !== 1 ) return;
            tsx = e.touches[0].pageX;
            tsy = e.touches[0].pageY;
        });
        document.body.addEventListener( 'touchend', function(e) {
            if (e.changedTouches.length !== 1 ) return;
            var dx = e.changedTouches[0].pageX - tsx, dy = e.changedTouches[0].pageY - tsy
                dxl = Math.abs(dx), dyl = Math.abs(dy);
            if ( dyl > dxl && dyl > 15 ) {
                dy < 0 ? navigateBy('Down', 'touch') : navigateBy('Up', 'touch');
                touching = false;
            } else if ( dxl > 15 ) {
                dx < 0 ? navigateBy('Right', 'touch') : navigateBy('Left', 'touch');
                touching = false;
            }
        });

        slider.on('beforeslide', function(from, to) {
            that.fire('beforeslide', [from, to])
            from = that.getScreen(from);
            to = that.getScreen(to);
            if(from) from.fire('beforehide');
            if(to) to.fire('beforeshow');
        });

        slider.on('afterslide', function(from, to) {
            that.fire('afterslide', [from, to])
            from = that.getScreen(from);
            to = that.getScreen(to);
            if(from) from.fire('afterhide');
            if(to) to.fire('aftershow', [hashPart.slice(1)]);
        });
    }

    this.start = function() {
        screens.each(function(index, screen) {
            screen.fire('init');
        });
        updateHash();
        var screen = that.getScreen( hashPart[0] );
        screen ? slider.showFirst( screen.index ) : slider.showFirst();
    }
    this.disable = function() { disabled = true; };
    this.enable = function() { disabled = false; };
    this.width = function() { return document.documentElement.clientWidth; };
    this.height = function() { return document.documentElement.clientHeight; };
    this.getIndex = function() { return slider.index(); };
    this.getScreen = function ( id ) { 
        if ( typeof(id) == 'number' ) return screens[id];
        for (var i = screens.length - 1; i >= 0; i--) {
            if( screens[i].name == id ) return screens[i];
        };
    };
    this.getCurrentScreen = function() {
        return this.getScreen(slider.index());
    };
    this.slideToScreen = function( id ) { return slider.slide(that.getScreen(id).index); };
    this.duration = duration;
    takeControl();
}
function Splash( stage ) {
    Event.apply(this);
    var showDuration = 1600, 
        hideDuration = 1600,
        visible = false,
        that = this;
        
    function show() {
        visible = true;
        baidu('#about').cssAnimate({ 
            translateY: stage.height(), 
            'box-shadow' : '0 20px 50px rgba(0,0,0,.3)' }
        , showDuration);

        baidu('#logo').cssAnimate({
            'translateY': stage.height() / 2 - 70,
            'translateX': 10,
            'font-size': '72px',
            'color': 'white'
        }, showDuration);
        that.fire('show');
    }

    function hide() {
        visible = false;
        baidu('#about').cssAnimate({ 
            'translateY': 0, 
            'box-shadow' : 'none' }
        , hideDuration);

        baidu('#logo').cssAnimate({
            'translateY': stage.getCurrentScreen().index == 0 ? stage.height() - baidu('#top-nav').height() : 0,
            'translateX': 0,
            'font-size': '32px',
            'color': 'black'
        }, hideDuration);
        that.fire('hide');
    }

    baidu('#logo').click( function() {
        visible ? hide() : show();
    });

    baidu('#about').click( function(e){
        e.stopPropagation();
        if(e.target.tagName.toLowerCase() == 'p' || e.target.tagName.toLowerCase()=='h2') return;
        hide();
    });

    var cheatCode = [38,38,40,40,37,39,37,39,65,66,65,66];
    var waiting = cheatCode.slice(0);
    baidu('body').keydown(function(e){
        if(waiting.shift()!=e.keyCode) waiting = cheatCode.slice(0);
        if(waiting.length == 0) {
            show();
            waiting = cheatCode.slice(0);
        }
    });
}

function Control( stage, splash ) {
    function getNavPosition( screenIndex ) {
        var y = 0;
        if ( screenIndex == 0 ) {
            y = stage.height() - baidu('#top-nav').height();
        }
        return y;
    }

    function fitNavPosition() {
        baidu('#top-nav, #logo').css3( { translateY: getNavPosition( stage.getCurrentScreen().index ) } )
    }

    // 导航条位置适应
    baidu(window).on( 'resize', function( ) {            
        fitNavPosition();
        stage.getCurrentScreen().fire('resize');
    });

    this.fitNavPosition = fitNavPosition;

    // 导航条位置适应
    stage.on('beforeslide', function( index_from, index_to ) {
        baidu('#top-nav, #logo').cssAnimate( { translateY: getNavPosition( index_to ) }, stage.duration );
    });

    // 更新导航当前项
    stage.on('afterslide', function( index_from, index_to ) {
        var name = stage.getScreen(index_to).name;
        baidu('#top-nav #menu ul li')
            .removeClass('current')
            .filter(function(index, dom){
                return ~this.getAttribute('screens').indexOf( name );
            })
            .addClass('current');
        var origin = window.location.hash.substr(1);
        if(origin.split('-')[0] != name)
            window.location.hash = name;
    });

    splash.on('show', stage.disable);
    splash.on('hide', stage.enable);
}

baidu(function(){       

    var stage = new Stage();
    var splash = new Splash( stage );
    var control = new Control(stage, splash);

    stage.getScreen('home')

        .on( 'init', function(){
            var screen = this;
            this.down = this.$.find('.nav.down').click(function(){
                stage.slideToScreen(1);
            });
        })

        .on('beforehide', function(){            
            this.down.cssAnimate( { 'translateY': 100 } );
        })

        .on('aftershow', function(){            
            this.down.cssAnimate( { 'translateY': -100 } );
        });

    stage.getScreen('topic')
        .on( 'init', function(){
            var inCaseMode = false;
            var tcontainer = this.$.find('.topic-container');
            var ccontainer = this.$.find('.case-container');
            var screen = this.$;
            var topicName;
            var that = this;

            this.enterDutaion = 2000,
            this.leaveDuration = 1500;
            baidu('.case-control .return-button').click(function(){
                var hash = window.location.hash.substr(1);
                var part = hash.split('-');
                switch(part.length) {
                    case 2:
                        leaveCaseMode();
                        break;
                    case 3:
                        baidu('.case-content').cssAnimate({
                            translateX: '100%',
                            opacity: 0
                        }, 500, function() {                            
                            doScroll( -scroll-210 );
                            showTopic(topicName);
                        });
                        break;
                }
            });

            baidu('.case-content').delegate('a.show-case', 'click', function(e){
                return; // 先在新窗口打开，细节交互再调节
                e.preventDefault();
                var path = baidu(e.target).attr('href');
                var title = baidu(e.target).attr('case-title');
                var name = baidu(e.target).attr('case-name');
                window.location.hash = ['topic', topicName, name].join('-');
                baidu('.case-control h1').html(title);
                baidu('.case-content').cssAnimate({
                    translateX: '-100%',
                    opacity: 0
                }, 500, function loadCase() {
                    var iframe = baidu('<iframe style="border:none; width: 100%;" src="' + path + '&iframe=true"></iframe>');
                    baidu('.case-content').empty().append(iframe);
                    baidu('.case-content').css3({
                        translateX: '100%'
                    });
                    baidu('.loading').css('display', 'block');
                    var loading = true;
                    var checkLoad = setInterval( function(){
                        if(!iframe[0].contentWindow) {                            
                            return clearInterval(checkLoad);
                        }
                        var height = iframe[0].contentWindow.document.documentElement.scrollHeight;
                        if( parseFloat(height) > 200 ) {
                            iframe.css('height', height);
                            if(loading) {
                                loading = false;
                                baidu('.loading').css('display', 'none');
                                baidu('.case-content').cssAnimate({
                                    translateX: '0',
                                    opacity: 1
                                }, 500);
                            }
                        }
                    }, 100);
                });
            });
            
            function enableScroll() {                
                baidu('body').on('mousewheel', handleScroll);
                that.on('navigate', handleNavigate);
                baidu('body')
                    .on('touchstart', handleTouchStart);

            }
            function disableScroll() {                
                baidu('body').off('mousewheel', handleScroll);
                that.off('navigate', handleNavigate);
                baidu('body').off('touchstart', handleTouchStart);
            }
            function handleTouchStart(e) {
                if(e.touches.length !== 1) return;
                baidu('body')
                    .on('touchmove', handleTouchMove)
                    .on('touchend', handleTouchEnd);
                handleTouchStart.SY = e.touches[0].clientY;
            }
            function handleTouchMove(e) {
                var touch = e.touches[0];
                var dy = touch.clientY - handleTouchStart.SY;
                doScroll(dy, true);
                handleTouchStart.SY = touch.clientY;
            }
            function handleTouchEnd() {                
                baidu('body')
                    .off('touchmove', handleTouchMove)
                    .off('touchend', handleTouchEnd);
            }
            function handleNavigate( e ) {
                if(e.source == 'keyboard') {
                    switch(e.direction) {
                        case 'Up':
                            doScroll( stage.height() * 0.8);
                            break;
                        case 'Down':
                            doScroll( -stage.height() * 0.8);
                    }
                }
            }
            function handleScroll( e ) {
                //clearTimeout(handleScroll.lastCall);
                //handleScroll.lastCall = setTimeout(function() {
                doScroll(e.wheelDelta);
                //}, 100);
            }
            var scroll = 0, meunTop = -210;
            function doScroll(delta) {

                if ( scroll == 0 && delta < 0 ) {
                    scroll = meunTop;
                }
                else if ( scroll == meunTop && delta > 0 ) {
                    scroll = 0;
                }
                else if( scroll + delta > meunTop) {
                    scroll = scroll == 0 ? 0 : meunTop;
                }
                else {
                    scroll += delta;
                }

                if ( scroll > 0 ) scroll = 0;  
                scroll = Math.max( scroll, -300 - baidu('.case-content').height() + stage.height());
                var ctrlScroll = Math.max( meunTop - scroll, 0 );

                baidu('.case-control').cssAnimate({translateY: ctrlScroll }, 800);
                screen.cssAnimate({translateY: scroll}, 800);
            }
            function showCases(caseMap) {
                baidu('.loading').css('display', 'none');
                var article = baidu('<article class="case-list"></article>').appendTo(baidu('.case-content').empty());
                var delay = 0;

                baidu('.case-content').css3({ opacity: 1, translateX: 0 });
                for(var name in caseMap) {
                    if(caseMap.hasOwnProperty(name)) {
                        var thecase = caseMap[name];
                        var section = baidu(
                            '<section>' 
                          + '  <img class="preview" src="fex/case/cases/' + name + '/preview.png" />'
                          + '  <h1 class="title">' + thecase.title + '</h1>'
                          + '  <p class="desc">' + thecase.desc + '</p>'
                          + '  <div class="tags">' + thecase.tags + '</div>'
                          + '  <a class="show-case" case-name="' + name + '" case-title="' +thecase.title + '" href="fex/case/show.php?name=' + name + '" target="_blank">显示</a>'
                          + '</section>');
                        plan(function(section) {
                            section.css3({ opacity: 0, translateY: 30 }).appendTo(article);
                            plan( function() {
                                section.cssAnimate({ opacity:1, translateY: 0 });
                            }, 10);
                        }, delay += 150, [section]);
                    }
                }
            }
            function loadCases() {                
                baidu('.loading').css('display', 'block');
                baidu.ajax({
                    type: 'get',
                    url: 'fex/case/list.php?topic=' + topicName,
                    success: showCases
                })
            }
            function removeCases() {
                baidu('.case-content').empty();
            }
            function enterCaseMode() {
                var duration = that.enterDutaion;
                stage.disable();
                baidu('#top-nav, #logo').cssAnimate({opacity: 0, translateY: '-100%', translateX: 0}, duration / 5);
                tcontainer.cssAnimate( { translateY: 1 }, duration );
                ccontainer.cssAnimate( { opacity: 1, translateY: 200 }, duration );
                screen.cssAnimate({translateY: scroll = -210}, duration );
                screen.css('overflow', 'visible');
                enableScroll();
                inCaseMode = true;
            }
            function leaveCaseMode() {
                var duration = that.leaveDuration;
                stage.enable();
                tcontainer.cssAnimate( { translateY: 0 }, duration, removeCases );
                ccontainer.cssAnimate( { opacity: 0, translateY: 800 }, duration );
                screen.cssAnimate({translateY: scroll = 0}, duration, function() {
                    screen.css('overflow', 'hidden');
                });
                baidu('#top-nav, #logo').cssAnimate({opacity: 1, translateY: 0}, duration);
                disableScroll();
                inCaseMode = false;
                window.location.hash = 'topic';
            }

            var showTopic = this.showTopic = function( name ) {
                var p = screen.find('p.' + name);
                if( p.length ) {
                    topicName = name;
                    baidu('.case-control h1').html(p.html());
                    baidu('.case-control').removeClass('point-tool point-data point-end').addClass('point-' + name);
                    if(!inCaseMode) {
                        enterCaseMode();
                        plan(loadCases, that.enterDutaion);
                    } else {
                        plan(loadCases);
                    }
                    window.location.hash = 'topic-' + name;
                }
            }
            screen.find('p').click(function(e) {
                showTopic(e.target.className);
                e.stopPropagation();
            });
            screen.click(function(e){
                ~e.target.className.indexOf('topic-container') && inCaseMode && leaveCaseMode();
            });
        })
        .on( 'aftershow', function(hashPart) {
            if(hashPart[0]) plan(function() {
                var restored = this.enterDutaion;
                this.enterDutaion = 0;
                this.showTopic(hashPart[0]);
                plan(function(){
                    this.enterDutaion = restored;                    
                }.bind(this), 500);
            }.bind(this), 10);
        });

    stage.getScreen('archive')
        .on( 'init', function(){
            this.heads = this.$.find('.archive-head');
            this.left = function() {
                return (stage.width() - this.heads.outerWidth() * this.heads.length) / 2 + 20
            }
            this.middle = function() {
                return (stage.width() - this.heads.width()) / 2;
            }
            this.layout = function() {
                var s = this;
                s.heads.each(function(index, dom){
                    var m = baidu(dom);
                    m.css({
                        left: s.left() + index * m.width(),
                        opacity: 1
                    }, 300);
                });
            }

            var ss = this.slideShow = new SlideShow({
                container : '#archive-container',
                duration: 500,
                allowFold: true,
                showDelay: 350,
                foldDelay: 350,
                effect: {
                    fold: { ratio: 0.03, both: true },
                    fade: true
                }
            });
            var ws = this.slideShow2 = new SlideShow({
                container : '#word-container',
                duration: 1000,
                direction: '-X',
                allowFold: true,
                showDelay: 350,
                foldDelay: 350,
                effect: {
                    fold: { ratio: 0.03, both: true },
                    fade: true
                }
            })
            var _this = this, index;
            var heads = this.heads
                .on('mouseenter', function(e){
                    _this.$.find('h1').cssAnimate({opacity: 0});
                    var target = baidu(e.target);
                    index = target.prevAll().length;
                    active(index);
                });

            var currentIndex = undefined;
            function active(index) {
                ss.slide(index);
                ws.slide(index);
                heads.filter('.current').removeClass('current');
                heads.eq(index).addClass('current');
                currentIndex = index;
            }

            this.on('navigate', function(e) {
                var index = currentIndex;
                switch(e.direction) {
                    case 'Left':
                        if ( index === undefined || index == 0) active(heads.length - 1);
                        else active( index - 1 );
                        break;
                    case 'Right':
                        if ( index === undefined || index == heads.length - 1 ) active(0);
                        else active( index + 1 );
                        break;
                }
            });

            this.fit('#archive-container');
            this.fit('#word-container');
        })
        .on('resize', function(width){
            this.layout();
        })
        .on('beforeshow', function(){
            this.heads.css( { 'left': this.middle() } );
            this.layout();
        })
        .on('beforehide', function(){
            this.heads.cssAnimate({opacity: 0});
        })
    
    stage.getScreen('team')
        .on( 'init', function(){       
            var container = this.$.find('#team-container');
            var drawing = this.$.find('#drawing-layer');
            var dialog = this.$.find('#dialog');
            var ly = 0, lx = 0;
            var last_index;
            var mcount = 34;     
            var _this = this;
            var prev = _this.prev = _this.$.find('.nav.prev').hide();
            var next = _this.next = _this.$.find('.nav.next');
            var farRatio = this.farRatio = 0.2;

            baidu.ajax({
                url: 'fex/member/data.json',
                dataType: 'json',
                success: init
            });

            function init( data ) {
                var seq = [], mcount = data.length;
                for(var i = 0; i < mcount; i++) seq.push(i);
                seq.sort(function(){return Math.random() > 0.5 ? 1 : -1;});

                for(var i = 0; i < mcount; i++) {
                    baidu('<div class="team-member" style="background-image: url(fex/member/' + seq[i] + '.png)" index="' + seq[i] + '"></div>').appendTo(container);
                }                    
                plan(function(){
                    var sw = stage.width(),
                        cw = baidu('#team-container').outerWidth();
                    baidu('#drawing-layer').css('width', sw + cw * farRatio);
                }, 10);
                var members = _this.$.find('.team-member');
                var stand_timeout = 400, stand_timer;

                container.delegate('.team-member', 'mouseenter', function(e){
                    var target = baidu(e.target);
                    var index = +target.attr('index');

                    members.removeClass('stand see-left see-right');
                    target.prevAll().addClass('see-right');
                    target.nextAll().addClass('see-left');


                    var left = target.position().left - target.width() / 2 + target.parent().position().left - 10;


                    dialog.html('<h1>' + data[index][0] + '</h1><p>' + data[index][1] + '</p>');
                    dialog.cssAnimate( { 
                        translateX: left,
                        opacity: 1,
                        translateY: 0 
                    }, 600);

                    clearTimeout(stand_timer);
                    stand_timer = setTimeout(function(){
                        target.addClass('stand');
                    }, stand_timeout);
                });

                container.on('mouseleave', function(e){             
                    members.removeClass('stand see-left see-right');
                    dialog.cssAnimate({
                        opacity: 0,
                        translateY: -100
                    });
                    clearTimeout(stand_timer);                
                });


                var translateX = 0, bodyWidth = members.width();

                function hasNext(sw, cw) {
                    sw = sw || stage.width();
                    cw = cw || container.outerWidth();
                    return translateX + sw < cw;
                }
                function hasPrev() {
                    return translateX > 0;
                }
                function go ( sw, cw ) {
                    sw = sw || stage.width();
                    cw = cw || container.outerWidth();
                    container.stop().cssAnimate({ translateX: -translateX }, 1600 );
                    dialog.cssAnimate({opacity: 0, translateY: -100});
                    drawing.cssAnimate({
                        translateX: -translateX * farRatio
                    }, 1600);
                    hasNext(sw, cw) ? next.show() : next.hide();
                    hasPrev() ? prev.show() : prev.hide();
                }
                function goNext(){ 
                    var sw = stage.width(),
                        cw = container.outerWidth();
                    if ( !hasNext(sw, cw) ) return;
                    var increase = Math.min( sw - bodyWidth, cw - sw - translateX );
                    translateX += increase;                    
                    go( sw, cw );
                }
                function goPrev(){ 
                    var sw = stage.width(),
                        cw = container.outerWidth();
                    if ( !hasPrev() ) return;
                    var decrease = Math.min( sw - bodyWidth, translateX );
                    translateX -= decrease;
                    go( sw, cw );
                }

                next.click(goNext);
                prev.click(goPrev);
                _this.on('navigate', function(e){
                    if ( e.source != 'keyboard' ) return;
                    switch(e.direction) {
                         case 'Left': return goPrev();
                         case 'Right': return goNext();
                    }
                });

                var dscx = 0, dstx;
                function drag(e) {
                    e.preventDefault();
                    if(e.touches) {
                        if(e.touches.length !== 1) return;
                        e = e.touches[0];
                    }
                    var dx = e.clientX - dscx;
                    if ( hasNext() ) {
                        next.show();
                    } else {
                        next.hide();
                        if ( dx < -1 ) return;
                    }
                    if ( hasPrev() ) {
                        prev.show();
                    } else {
                        prev.hide();
                        if ( dx > 1 ) return;
                    }
                    translateX = dstx - dx;
                    container.css3( { translateX: -translateX } );
                    drawing.css3( { translateX: -translateX * farRatio } );
                }
                container.on('dragstart', function(e) { e.preventDefault(); } );
                _this.$.on( 'dragstart', function(e) { e.preventDefault(); } );

                if(window.ontouchstart === undefined) {
                    _this.$.on( 'mousedown', function(e) {
                        dstx = translateX;
                        dscx = e.clientX;
                        _this.$.on('mousemove', drag);
                    } );

                    _this.$.on( 'mouseup', function(e) {
                        _this.$.off('mousemove', drag);
                    } );
                } else { 
                    var ts;
                    _this.$[0].addEventListener('touchstart', function(e) {
                        if ( e.touches.length !== 1 ) return;
                        ts = +new Date();
                        dstx = translateX;
                        dscx = e.touches[0].clientX;
                        _this.$[0].addEventListener('touchmove', drag);
                    });
                    _this.$[0].addEventListener('touchend', function(e) {
                        _this.$[0].removeEventListener('touchmove', drag);
                        if((+new Date()) - ts < 500) {
                            var dx = e.changedTouches[0].clientX - dscx;
                            if(dx < -20 && hasNext()) goNext();
                            if(dx > 20 && hasPrev()) goPrev();
                        }
                    });
                }
                
            }                      
            
        })
        
        .on('aftershow', function() {
            setTimeout(function(){
                this.prev.cssAnimate( '+show' , 200 );
                this.next.cssAnimate( '+show' , 200 );
            }.bind(this), 100);
        })

        .on('beforehide', function(){                 
            this.prev.cssAnimate( '-show' , 200 );
            this.next.cssAnimate( '-show' , 200 );
        });

    stage.getScreen('contact')
        .on('init', function(){
            this.github = this.$.find('#github').addClass('hide');
        })
        .on('aftershow', function(){
            this.github.removeClass('hide');
        })
        .on('beforehide', function(){
            this.github.addClass('hide');
        })
    stage.start();
    control.fitNavPosition();
});