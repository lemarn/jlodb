(function($) {
    // Activity default parameters
    var defaults = {
        name        : "sudoku",             // The activity name
        template    : "template.html",      // Activity html template
        css         : "style.css",          // Activity css style sheet
        lang        : "fr-FR",              // Current localization
        level       : 1,                    // Grid level
        highlight   : [],                   // Elements to highlight for tutorial
        comment     : "",
        width       : 9,                    // Line width
        debug       : true                 // Debug mode
    };

    var mapping = { 'a':1, 'b':2, 'c':3, 'd':4, 'e':5, 'f':6, 'g':7, 'h':8, 'i':9,
                    '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9 };

    // private methods
    var helpers = {
        // @generic: Check the context
        checkContext: function(_settings){
            var ret         = "";
            if (!_settings.context)         { ret = "no context is provided in the activity call."; } else
            if (!_settings.context.onquit)  { ret = "mandatory callback onquit not available."; }

            if (ret.length) {
                ret+="\n\nUsage: $(\"target\")."+_settings.name+"({'onquit':function(_ret){}})";
            }
            return ret;
        },
        // Get the settings
        settings: function($this, _val) { if (_val) { $this.data("settings", _val); } return $this.data("settings"); },
        // Binding clear
        unbind: function($this) {
            $(document).unbind("keypress keydown");
            $this.unbind("mouseup mousedown mousemove mouseleave touchstart touchmove touchend touchleave");
        },
        // Quit the activity by calling the context callback
        end: function($this) {
            var settings = helpers.settings($this);
            helpers.unbind($this);
            settings.context.onquit($this,{'status':'success', 'score':settings.score});
        },
        loader: {
            css: function($this) {
                var settings = helpers.settings($this), cssAlreadyLoaded = false, debug = "";
                if (settings.debug) { var tmp = new Date(); debug="?time="+tmp.getTime(); }

                $("head").find("link").each(function() {
                    if ($(this).attr("href").indexOf("activities/"+settings.name+"/"+settings.css) != -1) { cssAlreadyLoaded = true; }
                });

                if(cssAlreadyLoaded) { helpers.loader.template($this); }
                else {
                    $("head").append("<link></link>");
                    var css = $("head").children(":last");
                    var csspath = "activities/"+settings.name+"/"+settings.css+debug;

                    css.attr({ rel:  "stylesheet", type: "text/css", href: csspath }).ready(
                        function() { helpers.loader.template($this); });
                }
            },
            template: function($this) {
                var settings = helpers.settings($this), debug = "";
                if (settings.debug) { var tmp = new Date(); debug="?time="+tmp.getTime(); }

                // Load the template
                var templatepath = "activities/"+settings.name+"/"+settings.template+debug;
                $this.load( templatepath, function(response, status, xhr) { helpers.loader.build($this); });
            },
            build: function($this) {
                var settings = helpers.settings($this);
                if (settings.context.onload) { settings.context.onload($this); }

                // Resize the template
                var fontSize= Math.floor(($this.height()-11)/27);
                $this.css("font-size", fontSize+"px");
                $this.find("#menu").css("font-size", Math.floor(($this.width()-$this.height())/6)+"px");
                $this.find("#keypad").css("font-size", Math.floor(2*fontSize)+"px");

                // Update the grid
                $this.find("div.border").each(function(index) {
                    var r = Math.floor(Math.random()*2)+1;
                    $(this).css("background-image", "url('res/img/svginventoryicons/background/border/square0"+r+".svg')");
                });

                // HIGHLIGHT
                for (var i in settings.highlight) {
                    switch (settings.highlight[i][0]) {
                        case "col":
                            for (var j=0; j<3; j++) for (var k=0; k<3; k++) {
                                $($this.find("#grid.f td.cell")
                                    .get(Math.floor(settings.highlight[i][1]/3)*9+settings.highlight[i][1]%3+k*3+j*27))
                                    .addClass(settings.highlight[i][2]).addClass("hl"+i);
                            }
                        break;
                        case "row":
                            for (var j=0; j<3; j++) for (var k=0; k<3; k++) {
                                $($this.find("#grid.f td.cell")
                                    .get(Math.floor(settings.highlight[i][1]/3)*27+3*(settings.highlight[i][1]%3)+k*9+j))
                                    .addClass(settings.highlight[i][2]).addClass("hl"+i);
                            }
                        break;
                        case "box":
                            for (var j=0; j<9; j++) {
                                $($this.find("#grid.f td.cell").get(j+settings.highlight[i][1]*9))
                                    .addClass(settings.highlight[i][2]).addClass("hl"+i);
                            }
                        break;
                        case "cell":
                                $($this.find("#grid.f td.cell").get(settings.highlight[i][1]))
                                    .addClass(settings.highlight[i][2]).addClass("hl"+i);
                        break;
                    }
                }

                $this.find("div.fill").each(function(index) {
                    var vY = Math.floor(index/9) + (Math.floor((index%9)/3)) - Math.floor((index%27)/9);
                    var vX = index%3 + 3*Math.floor((index%27)/9);
                    var elt = settings.data[vY*settings.width+vX];
                    if (elt>='1' && elt<='9') {
                        $(this).text(mapping[elt]).addClass("final");
                        $(this).bind("mousedown touchstart",function(event) {
                            var val=$(this).text();
                            $this.find("div.fill").each(function() {
                                $(this).toggleClass("value", ($(this).text()==val));
                            });
                        });
                    }
                    else {
                        $(this).bind("mousedown touchstart",function(event) {
                            if (settings.interactive) {
                                var $keypad = $this.find("#keypad");
                                var vEvent = (event && event.originalEvent &&
                                            event.originalEvent.touches && event.originalEvent.touches.length)?
                                                event.originalEvent.touches[0]:event;

                                var val=$(this).text();
                                if (val.length) {
                                    $this.find("div.fill").each(function() {
                                        $(this).toggleClass("value", ($(this).text()==val));
                                    });
                                } else $this.find("div.fill.value").removeClass("value");

                                helpers.highlight($this, vX, vY);

                                var vTop = vEvent.clientY - $this.offset().top;
                                var vLeft = vEvent.clientX - $this.offset().left;

                                $this.find("#keypad .k").removeClass("s");
                                settings.keypad = $(this);
                                settings.key    = -1;

                                var tmp = $this.find("#bg1").height()/1.5;
                                if (vTop<tmp)   { vTop = tmp; }
                                if (vLeft<tmp)  { vLeft = tmp; }
                                if (vTop+tmp>$this.height())    { vTop=$this.height()-tmp; }
                                if (vLeft+tmp>$this.width())    { vLeft=$this.width()-tmp; }
                                $keypad.css("top", vTop+"px").css("left", vLeft+"px").show();
                            }
                            event.preventDefault();
                        })

                        $(this).next().find("div").each(function(_index) { $(this).bind("mousedown touchstart",function(event) {
                            if (settings.interactive) {
                                var mode = $this.find("#grid").hasClass("f");
                                if (mode) {
                                    $(this).closest("td.cell").removeClass("wrong");
                                    $(this).closest('.hint').hide().prev().text($(this).text()).show();
                                    $(this).closest('.cell').removeClass("h");
                                    if (helpers.check($this)) {
                                        settings.interactive = false;
                                        if (settings.timer.id) { clearTimeout(settings.timer.id); settings.timer.id=0; }
                                        settings.score = helpers.score(settings.level, settings.timer.value, settings.help);
                                        setTimeout(function() { helpers.end($this); }, 1000);
                                    }
                                }
                                else {

                                    var $keypad = $this.find("#keypad");
                                    var vEvent = (event && event.originalEvent &&
                                                event.originalEvent.touches && event.originalEvent.touches.length)?
                                                    event.originalEvent.touches[0]:event;

                                    var vTop = vEvent.clientY - $this.offset().top;
                                    var vLeft = vEvent.clientX - $this.offset().left;

                                    $this.find("#keypad .k").removeClass("s");
                                    settings.keypad = $(this);
                                    settings.key    = -1;

                                    var tmp = $this.find("#bg1").height()/1.5;
                                    if (vTop<tmp)   { vTop = tmp; }
                                    if (vLeft<tmp)  { vLeft = tmp; }
                                    if (vTop+tmp>$this.height())    { vTop=$this.height()-tmp; }
                                    if (vLeft+tmp>$this.width())    { vLeft=$this.width()-tmp; }
                                    $keypad.css("top", vTop+"px").css("left", vLeft+"px").show();
                                }
                            }
                            event.preventDefault();
                            })
                        });
                    }
                });

                $this.bind("mousemove touchmove", function(event) {
                    var settings = helpers.settings($this), $keypad = $this.find("#keypad");
                    if (settings.keypad) {
                        var vEvent = (event && event.originalEvent && event.originalEvent.touches &&
                                    event.originalEvent.touches.length)? event.originalEvent.touches[0]:event;
                        var vTop = vEvent.clientY;
                        var vLeft = vEvent.clientX;
                        var vSize = settings.$keys[0].width();
                        var vAlready = false;
                        settings.key = -1;
                        for (var i in settings.$keys) {
                            settings.$keys[i].removeClass("s");
                            if (!vAlready) {
                                var vOffset = settings.$keys[i].offset();
                                vAlready = ( vTop>=vOffset.top && vLeft>=vOffset.left &&
                                            vTop<vOffset.top+vSize && vLeft<vOffset.left+vSize );
                                if (vAlready) { settings.key = i; settings.$keys[i].addClass("s"); }
                            }
                        }
                    }
                    event.preventDefault();
                });

                $this.bind("mouseup mouseleave touchend touchleave", function(event) {
                    var settings = helpers.settings($this), $keypad = $this.find("#keypad");

                    if (settings.key!=-1 && settings.keypad) {
                        var vVal = settings.$keys[settings.key].text();
                        settings.keypad.text(vVal==0?"":vVal);
                        settings.keypad.closest('td.cell').removeClass("wrong");
                        
                        if (vVal!=0) {
                            if (settings.keypad.hasClass("fill")) {
                                for (var i in settings.highlight) {
                                    if (settings.highlight[i].length>3) {
                                        var done = true;
                                        for (var j in settings.highlight[i][3]) {
                                            if (!$($this.find("#grid.f td.cell .fill").get(settings.highlight[i][3][j])).html()) {
                                                done = false;
                                            }
                                        }
                                        if (done) {
                                            $this.find("#grid.f .hl"+i).removeClass(".hl"+i).removeClass(settings.highlight[i][2]);
                                        }
                                    }
                                }

                                if (helpers.check($this)) {
                                    settings.interactive = false;
                                    settings.score = helpers.score(settings.level, settings.timer.value, settings.help);
                                    if (settings.timer.id) { clearTimeout(settings.timer.id); settings.timer.id=0; }
                                    setTimeout(function() { helpers.end($this); }, 1000);
                                }
                            }
                            else
                            {
                                settings.keypad.closest('.cell').addClass("h");
                            }

                        }
                    }

                    $this.find(".active").removeClass("s");
                    $keypad.hide();
                    settings.keypad = 0;
                    event.preventDefault();
                });


                // COMMENT
                if ($.isArray(settings.comment)) {
                    $this.find("#comment>div").html("");
                    for (var i in settings.comment) {
                        $this.find("#comment>div").append("<p>"+(settings.comment[i].length?settings.comment[i]:"&#xA0;")+"</p>"); }
                } else { $this.find("#comment>div").html(settings.comment); }

                // LOCALE HANDLING
                $this.find("h1#label").html(settings.label);
                if (settings.locale) {$.each(settings.locale, function(id,value) { $this.find("#"+id).html(value); });}
                if (!$this.find("#splashex").is(":visible")) { setTimeout(function() { $this[settings.name]('next'); }, 500); }
            }
        },
        // Highlight the row, the col and the subgrid which contain the selected cell
        highlight:function($this, _posX, _posY) {
            $this.find("td.cell").each(function(index) {
                $(this).removeClass("level1").removeClass("level2").removeClass("level3");
                if (_posX>=0) {
                    var vY = Math.floor(index/9) + (Math.floor((index%9)/3)) - Math.floor((index%27)/9);
                    var vX = index%3 + 3*Math.floor((index%27)/9);
                    var vSquare = Math.floor(_posY/3)*3+Math.floor(_posX/3);
                    var vValue = 0;
                    if (vX==_posX) { vValue++; }
                    if (vY==_posY) { vValue++; }
                    if (Math.floor(index/9)==vSquare) { vValue++; }
                    if (vValue) { $(this).addClass("level"+vValue); }
                }
            });
        },
        // Check if the grid is done
        check:function($this) {
            var settings = helpers.settings($this);
            var finish = true;
            $this.find("div.fill").each(function(index) {
                var vY = Math.floor(index/9) + (Math.floor((index%9)/3)) - Math.floor((index%27)/9);
                var vX = index%3 + 3*Math.floor((index%27)/9);
                 var elt = settings.data[vY*settings.width+vX];
                if (mapping[elt] != $(this).text()) { finish= false; }
            });
            if (finish) { $this.find("#effects").show(); }
            return finish;
        },
        // Update the timer
        timer:function($this) {
            var settings = helpers.settings($this);
            var vS = settings.timer.value%60;
            var vM = Math.floor(settings.timer.value/60)%60;
            var vH = Math.floor(settings.timer.value/3600);
            if (vH>99) { vS=99; vM=99; vH=99; }
            $this.find("#time").text((vH<10?"0":"")+vH+(vM<10?":0":":")+vM+(vS<10?":0":":")+vS);
            settings.timer.value++;
            settings.timer.id = setTimeout(function() { helpers.timer($this); }, 1000);
        },
        // compute the score regarding the time and the grid level
        score:function(level, time, help) {
            var timeref = 1000*level;
            var score = 1;
            if (time<timeref)       { score = 5; } else
            if (time<timeref*1.2)   { score = 4; } else
            if (time<timeref*1.5)   { score = 3; } else
            if (time<timeref*2)     { score = 2; }
            score=Math.max(0,score-help);
            return score;
        }
    };

    // The plugin
    $.fn.sudoku = function(method) {

        // public methods
        var methods = {
            init: function(options) {
                // The SUDOKU initial settings
                var settings = {
                    interactive : false,
                    fillmode    : true,     // false in the hint mode
                    timer: {                // the general timer
                        id      : 0,        // the timer id
                        value   : 0         // the timer value
                    },
                    score       : 1,        // The score (from 1 to 5)
                    keypad      : 0,
                    key         : -1,
                    help        : 0,        // number of help
                    $keys       : []
                };

                // Check the context and send the load
                return this.each(function() {
                    var $this = $(this);
                    helpers.unbind($this);

                    var $settings = $.extend({}, defaults, options, settings);
                    var checkContext = helpers.checkContext($settings);
                    if (checkContext.length) {
                        alert("CONTEXT ERROR:\n"+checkContext);
                    }
                    else {
                        $this.removeClass();
                        if ($settings["class"]) { $this.addClass($settings["class"]); }
                        helpers.settings($this.addClass(defaults.name), $settings);
                        helpers.loader.css($this);
                    }
                });
            },
            // Pause the game, hide the grid and display the help
            pause: function() {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.timer.id) {
                    clearTimeout(settings.timer.id); settings.timer.id=0;
                    $this.find("#grid9x9").hide();
                }
                else {
                    helpers.timer($this);
                    $this.find("#grid9x9").show();
                }
            },
            // Toggle the game mode
            toggle: function() {
                var $this = $(this) , settings = helpers.settings($this);
                if (settings.interactive) {
                    var mode = $this.find("#grid").hasClass("f");
                    if (!mode) {
                        $this.find("#grid").addClass("f");
                        $this.find("#toggle>img").attr("src", "res/img/svginventoryicons/pencil/pen01.svg");
                        $this.find("div.fill").each(function(index) {
                            var vHintEmpty = true;
                            $(this).next().find("div").each(function(_index) {
                                if ($(this).text()) { vHintEmpty = false; } });
                            if (vHintEmpty) { $(this).show().next().hide(); } });
                    }
                    else {
                        $this.find("#grid").removeClass("f");
                        $this.find("#toggle>img").attr("src", "res/img/svginventoryicons/pencil/pencil01.svg");
                        helpers.highlight($this, -1,-1);
                        $this.find("div.fill").each(function(index) { if (!$(this).text()) { $(this).hide().next().show(); } });
                    }
                }
            },
            // Close the help and display the grid
            next: function() {
                var $this = $(this) , settings = helpers.settings($this);
                $(this).find("#grid9x9").show();

                // Keypad
                for (var i=0; i<10; i++) {
                    settings.$keys.push($this.find("#keypad #key"+i).css("top",(1.8*Math.cos(2*Math.PI*(i/10))-0.5)+"em")
                                       .css("left",(1.8*Math.sin(2*Math.PI*(i/10))-0.5)+"em")
                                       .show());
                }

                settings.interactive = true;
                helpers.timer($this);
            },
            // Abort the game from the confirmation panel
            quit: function() {
                var $this = $(this) , settings = helpers.settings($this);
                settings.interactive = false;
                if (settings.timer.id) { clearTimeout(settings.timer.id); settings.timer.id=0; }
                settings.context.onquit($this,{'status':'abort'});
            },
            help: function() {
                var $this = $(this) , settings = helpers.settings($this);
                $this.find("#mask").hide();
                settings.help++;
                
                $this.find("div.fill").each(function(index) {
                    var vY = Math.floor(index/9) + (Math.floor((index%9)/3)) - Math.floor((index%27)/9);
                    var vX = index%3 + 3*Math.floor((index%27)/9);
                    var elt = settings.data[vY*settings.width+vX];
                    if (mapping[elt] != $(this).text()) { $(this).closest("td").addClass("wrong"); }
                });
            }
        };

        if (methods[method])    { return methods[method].apply(this, Array.prototype.slice.call(arguments, 1)); } 
        else if (typeof method === 'object' || !method) { return methods.init.apply(this, arguments); }
        else { $.error( 'Method "' +  method + '" does not exist in sudoku plugin!'); }
    };
})(jQuery);


