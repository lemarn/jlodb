(function($) {

    // NOT SURE TO REMEMBER WHY (maybe because of class handling or score)
    // BUT JLODB PLUGIN HAS TO BE APPLIED ON A PARENT OBJECT OF THE ACTIVITY
    // NOT DIRECTLY ON THE ACTIVITY IT SELF

    var defaults = {
        debug       : false,
        url         : "",               // cross platform json (not available for the moment)
        id          : "activity",       // activity id
        // OVERWRITABLE METHODS
        onevent     : function($this, _begin)   { if (_begin) { helpers.settings($this).onstart($this); }
                                                  else        { helpers.settings($this).onfinish($this); } },
        onstart     : function($this)           { /** START THE ACTIVITY */ },
        onfinish    : function($this)           { /** FINISH THE ACTIVITY */ },
        onscore     : function($this, _ret)     { /** HANDLE THE SCORE */ return false; },
        onexercice  : function($this, _id)      { /** GET THE ID OF THE EXERCICE */ }

    };

    // private methods
    var helpers = {
        // Get the settings
        settings: function($this, _val) { if (_val) { $this.data("settings", _val); } return $this.data("settings"); },

        rerun       : function($this) {
            var settings = helpers.settings($this);
            helpers.run($this, settings.last, settings.args);
        },

        // RUN THE EXERCICE REGARDING THE ACTIVITY NAME AND ITS ARGUMENTS
        run         : function($this, _name, _args) {
            var settings = helpers.settings($this);

            settings.last = _name;
            settings.args = $.extend(true, {},_args);

            var args = $.extend({ 'context': settings.context } , _args);
            args.context = settings.context;

            if (typeof($this[_name])=='undefined') {
                $.getScript('activities/'+_name+'/'+_name+'.js', function() { 
                    $this.find("#"+settings.id)[_name](args); });
            }
            else { $this.find("#"+settings.id)[_name](args); }
        },

        // FORCE QUIT FROM THE CURRENT EXERCICE
        quit        : function($this) {
            var settings = helpers.settings($this);
            $this.find("#"+settings.id)[settings.last]('quit');
        },

            // GET EXERCICE AND LAUNCH
        exercice    : function($this, _args) {
            var settings = helpers.settings($this);
            // HANDLE ARGS
            var tmp     = new Date();
            var args    = "?debug="+tmp.getTime();
            for (var i in _args) { args+="&"+i+"="+_args[i]; }

            // GET EXERCICE FROM DATABASE AND LAUNCH
            var url     = "api/exercice.php"+args;

            $.getJSON(url, function (data) {
                if (data.status=="error") { helpers.exercice($this, {id:"nlx"}); }
                else {
                    var d = data.data;
                    if (data.locale) { if (d.locale) { d.locale = $.extend(d.locale, data.locale); } else { d.locale = data.locale; } }
                    d.label = data.label;
                    if (settings.onexercice) { settings.onexercice($this, data.id, data.activity); }

                    if (data.ext && jlodbext && jlodbext[data.ext]) {
                        jlodbext[data.ext].js(function() { helpers.run($this,data.activity, d); });
                    }
                    else { helpers.run($this,data.activity, d); }
                }
            });
        },

        // CLOSE THE EXERCICE
        end: function($this, _hide) {
            var settings = helpers.settings($this);
            if (_hide) {
                $this.find("#"+settings.id).html("").hide();
                $this.hide();
            }
            settings.onevent($this,false);
        }

    };

    // The plugin
    $.fn.jlodb = function(method) {

        // public methods
        var methods = {
            init: function(options, args) {
                // The settings
                var settings = {
                    last        : "",
                    args        : "",
                    context     : {
                        onquit : function($activity, _ret) {
                            var $this = $activity.closest(".jlodb"), settings = helpers.settings($this);
                            if (_ret.status!="success" || !settings.onscore($this, _ret)) { helpers.end($this, true); }
                        },
                        onload: function($activity) {
                            var $this = $activity.closest(".jlodb"), settings = helpers.settings($this);
                            if (!$this.is(":visible")) { $this.css("opacity",0).show().animate({opacity:1},1000); }
                            $this.find("#"+settings.id).show();
                            settings.onevent($this,true);
                        }
                    }
                };

                return this.each(function() {
                    var $this = $(this);

                    var $settings = $.extend(true, {}, defaults, options, settings);
                    helpers.settings($this, $settings);
                    $this.addClass("jlodb");
                    if (args && args.activity && args.args) { helpers.run($this, args.activity, args.args); }
                    else                                    { helpers.exercice($this, args); }
                });
            },
            quit: function() { helpers.quit($(this)); return $(this);},
            close: function(_hide) { helpers.end($(this), _hide); return $(this); },
            reload: function() { helpers.end($(this), false); helpers.rerun($(this)); return $(this); }
        };

        if (methods[method])    { return methods[method].apply(this, Array.prototype.slice.call(arguments, 1)); } 
        else if (typeof method === 'object' || !method) { return methods.init.apply(this, arguments); }
        else { $.error( 'Method "' +  method + '" does not exist in jlodb plugin!'); }
    };
})(jQuery);

// editor plugin

var displaytype =  { normal:0, scientific:1, physics:2 };
var nodemathtype = { final:1, rootonly:2, commutative :4, associative:8 };

(function($) {
    var defaults = {
        accept  : ".ea",
        mathml  : "#escreen",
        modif   : true,
        size    : [1.9,3.9],
        newnode : function($this, _elt) { return 0; }
    };

    var nodecounter = 1;
    var nodetype = {
        abs:    { type:"op", value:"abs", abstract:"", l:.6, c:1, m:"<mo>|</mo>c0<mo>|</mo>", t:"|c0|",
                  process:function() { return Math.abs(this.children[0].process()); } },
        cos:    { type:"op", value:"cos", abstract:"", l:.6, c:1, m:"<mi>cos</mi><mo>&#x2061;</mo><mo>(</mo>c0<mo>)</mo>", t:"cos(c0)",
                  process:function() { return Math.cos(this.children[0].process()); } },
        div:    { type:"op", value:"/", abstract:"", c:2, m:"<mfrac><mrow>c0</mrow><mrow>c1</mrow></mfrac>",
            needbracket:function() {
                ret = [false, false];
                for (var i=0; i<2; i++)
                if (this.children&&this.children[i]&&this.children[i].type=="op")
                    if (this.children[i].value=="+"||this.children[i].value=="-" ||
                        this.children[i].value=="*"||this.children[i].value=="/")
                        ret[i]=true;
                return ret;
            },
            t:function() { var bra = this.needbracket(); return (bra[0]?"(c0)":"c0")+"/"+(bra[1]?"(c1)":"c1"); },
            process:function() { return this.children[0].process()/this.children[1].process(); }
        },
        eq :    { type:"op", value:"=", abstract:"", c:2, m:"c0<mo>=</mo>c1", t:["c0=c1","c1=c0"],
                  p:function() { return nodemathtype.commutative | nodemathtype.associative; },
                  process:function() { return (this.children[0].process()==this.children[1].process()); } },
        exp:    { type:"op", value:"exp", abstract:"", l:.6, c:1, m:"<mi>exp</mi><mo>(</mo>c0<mo>)</mo>", t:"exp(c0)",
                  process:function() { return Math.exp(this.children[0].process()); } },
        gt :    { type:"op", value:">", abstract:"", c:2, m:"c0<mo>&gt;</mo>c1", t:["c0>c1","c1<c0"],
                  process:function() { return (this.children[0].process()>this.children[1].process()); } },
        ident:  { type:"op", value:"", abstract:"",  c:1, m:"c0", t:"c0", process:function() { return this.children[0].process(); } },
        log:    { type:"op", value:"log", abstract:"", l:.6, c:1, m:"<mi>log</mi><mo>(</mo>c0<mo>)</mo>", t:"log(c0)",
                  process:function() { return Math.log(this.children[0].process()); } },
        lt :    { type:"op", value:"<", abstract:"", c:2, m:"c0<mo>&lt;</mo>c1", t:["c0<c1","c1>c0"],
                  process:function() { return (this.children[0].process()<this.children[1].process()); } },
        minus:  { type:"op", value:"-", abstract:"", c:2,
            needbracket:function() {
                ret = [false, false];
                for (var i=0; i<2; i++)
                if (this.children&&this.children[i]&&this.children[i].type=="op")
                    if (this.children[i].value=="+"||this.children[i].value=="-")
                        ret[i]=true;
                return ret;
            },
            m:function() {
                var ret=["c0","c1","<mo>-</mo>"];
                var bra=this.needbracket();
                for (var i=0; i<2; i++) if (bra[i]) { ret[i] = "<mo>(</mo>c"+i+"<mo>)</mo>"; }
                return ret[0]+ret[2]+ret[1];
            },
            t:function() {
                var bra=this.needbracket();
                var val=[bra[0]?"(c0)":"c0", bra[1]?"(c1)":"c1"];
                return [ val[0]+"-"+val[1] ];
            },
            process:function() { return this.children[0].process()-this.children[1].process(); }
        },
        mult:   { type:"op", value:"×", abstract:"", c:2, p:function() { return nodemathtype.commutative | nodemathtype.associative; },
            needbracket:function() {
                ret = [false, false];
                for (var i=0; i<2; i++)
                if (this.children&&this.children[i]&&this.children[i].type=="op")
                    if (this.children[i].value=="+"||this.children[i].value=="-")
                        ret[i]=true;
                return ret;
            },
            m:function() {
                var ret=["c0","c1","<mo>×</mo>"];
                var bra=this.needbracket();
                for (var i=0; i<2; i++) if (bra[i]) { ret[i] = "<mo>(</mo>c"+i+"<mo>)</mo>"; }
                return ret[0]+ret[2]+ret[1];
            },
            t:function() {
                var bra=this.needbracket();
                var val=[bra[0]?"(c0)":"c0", bra[1]?"(c1)":"c1"];
                return [ val[0]+"*"+val[1], val[1]+"*"+val[0] ];
            },
            process:function() { return this.children[0].process()*this.children[1].process(); }
        },
        neg:  { type:"op", value:"-", abstract:"", c:1,
            needbracket:function() {
                ret = false;
                if (this.children&&this.children[0]&&this.children[0].type=="op")
                    if (this.children[0].value=="+"||this.children[0].value=="-")
                        ret=true;
                return ret;
            },
            m:function(_node) { return "<mo>-</mo>"+(this.needbracket()?"<mo>(</mo>c0<mo>)</mo>":"c0"); },
            t:function(_node) { return "-"+(this.needbracket(_node)?"(c0)":"c0"); },
            process:function() { return -this.children[0].process(); }
        },
        pi:     { type:"value", abstract:"π", value:Math.PI},
        plus:   { type:"op", value:"+", abstract:"", c:2, m:"c0<mo>+</mo>c1", t:["c0+c1","c1+c0"],
                  p:function() { return nodemathtype.commutative | nodemathtype.associative; },
                  process:function() { return this.children[0].process()+this.children[1].process(); } },
        pow:    { type:"op", value:"^", abstract:"", c:2,
            needbracket:function() {
                ret = false;
                if (this.children&&this.children[0]&&this.children[0].type=="op")
                    if (this.children[0].value=="+"||this.children[0].value=="*"||
                        this.children[0].value=="/"||this.children[0].value=="-")
                        ret = true;
                return ret;
            },
            m:function() {
                return (this.needbracket()) ? "<msup><mrow><mo>(</mo>c0<mo>)</mo></mrow><mrow>c1</mrow></msup>" :
                                                     "<msup><mrow>c0</mrow><mrow>c1</mrow></msup>";
            },
            t:function() {
                var ret = ["pow(c0,c1)"];
                if (this.children&&this.children[1]&&this.children[1].value=="2"){
                    ret.push(this.needbracket()?"(c0)*(c0)":"c0*c0");
                }
                return ret;
            },
            process:function() { return Math.pow(this.children[0].process(),this.children[1].process()); }
        }
        
    };


    // private methods
    var helpers = {
        // Get the settings
        settings: function($this, _val) { if (_val) { $this.data("settings", _val); } return $this.data("settings"); },
        init: function($this) {
            var settings = helpers.settings($this);
            settings.$ed = $("<div id='ed'></div>");
            $this.html("").append(settings.$ed);

            for (var n in nodetype) { nodetype[n].id = n; }

            $this.bind("mousedown touchstart", function(_event) {
                if (settings.onclick) { settings.onclick($this, _event); } _event.preventDefault();
            });

            $this.droppable({accept:settings.accept,
                drop:function(event, ui) { helpers.editor.addroot($this, settings.getnode($this, $(ui.draggable).attr("id")) ); }
            });
        },
        node: function (_elt) {
            // INIT ATTRIBUTES
            var args = $.extend(true, { idx:        nodecounter++,
                                        id:         "",
                                        type:       "",
                                        subtype:    "",
                                        value:      "",
                                        abstract:   "",
                                        d:          0,
                                        c:          0,
                                        children:   [],
                                        width:      0,
                                        left:       0,
                                        process: function() { return this.value; } }, _elt);
            for (var i in args) { this[i]=args[i]; }

            // BUILD PROTOTYPE
            this.find = function (_idx) {
                var ret = 0;
                if (this.idx==_idx)      { ret = this; }
                else for (var i in this.children) { ret = ret || this.children[i].find(_idx); }
                return ret;
            };

            this.parent = function(_idx) {
                var ret = 0;
                for (var i in this.children) if (this.children[i].idx==_idx) { ret = this; }
                for (var i in this.children) { ret = ret || this.children[i].parent(_idx); }
                return ret;
            };

            this.equal = function(_node) {
                var ret = (this.type==_node.type && this.children.length==_node.children.length &&
                           this.subtype==_node.subtype );

                if (ret) {
                    if ( _node.value.length==2 && (_node.subtype=="line" || _node.subtype=="segment" || !_node.subtype)) {
                        ret = (this.value==_node.value || this.value==_node.value[1]+_node.value[0]);
                    }
                    else { ret = (this.value==_node.value); }
                }

                if (ret) {
                    if ((this.children.length==2) && (nodetype[this.type]) &&
                        (nodetype[this.type].p) && (nodetype[_this.type].p()&nodemathtype.commutative)) {

                        ret = ret && (  ( this.children[0].equal(_node.children[0]) &&
                                          this.children[1].equal(_node.children[1]) )  ||
                                        ( this.children[0].equal(_node.children[1]) &&
                                          this.children[1].equal(_node.children[0]) ) );
                    }
                    else {
                        for (var i in this.children) { ret = ret && this.children[i].equal(_node.children[i]); }
                    }
                }
                return ret;
            };

            this.update = function() {
                for (var i in this.children) { this.children[i].update(); }
                this.width = 0; this.left  = 0;
                for (var i in this.children) {
                    this.left += this.children[i].left + this.width;
                    this.width += this.children[i].width;
                }
                if (this.children.length) { this.left = this.left/this.children.length; }
                else { this.width = 1; }
            };

            this.label = function(_args) {
                var ret = this.abstract?this.abstract:this.value, size = 1;
                if (!ret) { ret=""; }

                if (typeof(ret)=="number") {
                    var p="";
                    if (_args && _args.displaytype) {
                        var i=0;
                        if (Math.abs(ret)>=1000) {
                            var ps=["","K","M","G","T","P","E","Z","Y"];
                            while (Math.abs(ret)>=1000) { i++; ret=ret/1000; }
                            if (_args.displaytype==displaytype.physics) { p=(i<ps.length)?ps[i]:"?"; } else
                            if (_args.displaytype==displaytype.scientific && i>0) {
                                if (_args && _args.mathml) {
                                    p="<mo>*</mo><msup><mrow><mn>10</mn></mrow><mrow><mn>"+(i*3)+"</mn></mrow></msup>";
                                }
                                else { p=(i>0?"*10^"+(3*i):""); }
                            }
                        } else if (Math.abs(ret)<1) {
                            var ps=["","m","µ","p","f","a","z","y"];
                            while (Math.abs(ret)<1) { i++; ret=ret*1000; }
                            if (_args.displaytype==displaytype.physics) { p=(i<ps.length)?ps[i]:"?"; } else
                            if (_args.displaytype==displaytype.scientific && i>0) {
                                if (_args && _args.mathml) {
                                    p="<mo>*</mo><msup><mrow><mn>10</mn></mrow><mrow><mo>-</mo><mn>"+(i*3)+"</mn></mrow></msup>";
                                }
                                else { p=(i>0?"*10^"+(3*i):""); }
                            }
                        }
                    }
                    if (_args && _args.nbdec) { ret = Math.floor(ret*Math.pow(10,_args.nbdec))/Math.pow(10,_args.nbdec); }
                    ret = ((_args && _args.mathml)?"<mn>"+ret+"</mn>":ret)+p;
                }

                switch (this.subtype) {
                    case "segment"  : ret="["+ret+"]"; break;
                    case "line"     : ret="("+ret+")"; break;
                }

                size = (this.l&&!this.abstract)?this.l:1-(ret.toString().length-1)*0.2;
                if (size<0.2 && (!_args || !_args.mathml) )     { ret = ret.substr(0,3)+"~"; size=0.4; }
                if (size!=1 &&  (!_args || !_args.onlytext) )   { ret = "<span style='font-size:"+size+"em;'>"+ret+"</span>"; }

                return ret;
            };

            this.mathml =  function(_args) {
                if (!_args) { _args={}; } _args.onlytext = true; _args.mathml=true;

                if (this.c) {
                    ret = (typeof(this.m)=="function")?this.m():this.m;
                    for (var i in this.children) {
                        var regexp = new RegExp("c"+i, "g");
                        ret = ret.replace(regexp, this.children[i].mathml(_args));
                    }
                }
                else { ret = this.label(_args); }
                return ret;
            };

            this.filled = function() {
                var ret = true;
                for (var i in this.children) { ret = ret && this.children[i].filled(); }
                if (this.value==0) { ret = false; } //TODO : FIX THIS
                return ret;
            };

            this.detach = function() {
                if (this.$html) { this.$html.detach(); this.$html = 0; }
                for (var i in this.children) { this.children[i].detach(); }
            };

            this.clone = function() {
                var children=[];
                if (this.children) { for (var i in this.children) { children.push(this.children[i].clone()); } }
                return $.extend({}, this, { children: children });
            }

        },

        editor: {
            addroot: function($this, _elt) {
                // SAVE THE CURRENT ROOT AND MOVE IT TO THE DEFAULT CHILDREN NEW ROOT
                var settings = helpers.settings($this), vOk = true, sav = settings.root;

                helpers.editor.clear($this);
                settings.root=helpers.editor.insert($this,true,_elt);

                if (settings.root.type=="op" && settings.root.p && (settings.root.p()&nodemathtype.final)) { vOk = false; }
                var hasChildren = _elt.children&&_elt.children.length;

                if (sav && sav.type && vOk && settings.root.c && !hasChildren) {
                    if (sav.p && sav.p()&nodemathtype.rootonly) { vOk = false; }
                    if (vOk) {
                        var elt = settings.root;
                        elt.children[elt.d] = sav;
                        helpers.editor.clear($this);
                        settings.root=helpers.editor.insert($this,true,elt);
                    }
                }

                helpers.editor.display($this);
                helpers.mathml($this);
            },
            insert: function($this,_root,_elt) {
                var settings = helpers.settings($this);
                var ret = new helpers.node(_elt);
                if (ret.type!="value") { ret.abstract=""; }

                ret.$html = $("<div class='ed' id='"+ret.idx+"'></div>");
                if (_elt.type) {
                    ret.$html.html("<div class='ea "+ret.type+"'><div class='label'>"+
                        ret.label({nbdec: settings.nbdec, displaytype: settings.displaytype})+"</div></div>");
                }
                settings.$ed.append(ret.$html);

                ret.$html.droppable({accept:settings.accept, greedy:true,
                    over: function(event, ui) { $(this).addClass("over"); },
                    out: function(event, ui) { $(this).removeClass("over"); },
                    drop:function(event, ui) {
                        $this.find(".over").removeClass("over");

                        var elt     = settings.root.find($(this).attr("id"));
                        var parent  = settings.root.parent($(this).attr("id"));
                        var vOK     = true;

                        var n = settings.getnode($this, $(ui.draggable).attr("id"));
                        if (n.type!="value") { n.abstract=""; }

                        if (n.p && n.p()&nodemathtype.rootonly) { vOK = false; }
                        if (n.type!="value" && parent && parent.type=="op" && parent.p && (parent.p()&nodemathtype.final) ) { vOK = false; }
                        if (elt.type && !settings.modif) { vOK = false; }

                        if (vOK) {
                            
                            if (n.type!="value" && parent && parent.type=="op" && parent.value=="ident") {
                                elt.detach(); elt=parent; elt.$html.show();
                            }

                            if (elt.type) { for (var i in elt.children) { elt.children[i].detach(); } elt.children=[]; }
                            var $html = elt.$html, idx = elt.idx;
                            elt = $.extend(true, elt, n);
                            elt.$html = $html;
                            elt.idx = idx;

                            elt.$html.html("<div class='ea "+elt.type+"'><div class='label'>"+
                                        elt.label({nbdec: settings.nbdec, displaytype: settings.displaytype})+"</div></div>");

                            elt.children=[];
                            for (var i=0; i<n.c; i++) {
                                elt.children.push(helpers.editor.insert($this,false,(n.children&&n.children.length>i)?n.children[i]:0));
                            }
                        }

                        helpers.editor.display($this);
                        helpers.mathml($this);
                    }
                });

                // FILL THE NEW CELL
                for (var i=0; i<ret.c; i++) {
                    var child = helpers.editor.insert($this,false,ret.children.length>i?ret.children[i]:0);
                    if (i<ret.children.length) { ret.children[i] = child; } else { ret.children.push(child); }
                }
                return ret;
            },
            display: function($this,_node,_level,_left) {
                var settings = helpers.settings($this);
                if (!_node)         { $this.find(".el").detach();_node=settings.root; _level=0; _left=0; _node.update(); }

                // DON'T SHOW THE IDENT
                if (_node.type=="op" && _node.value=="ident") {
                    if (_node.$html) { _node.$html.hide(); }
                    return helpers.editor.display($this,_node.children[0],_level,_left);
                }

                var level = _level;
                var width = 0;
                for (var i in _node.children) {
                    level=Math.max(level, helpers.editor.display($this,_node.children[i],_level+1,_left+width));
                    width+=_node.children[i].width;
                }
                var links="";
                var offset = 0;
                if (_node.children && _node.children.length) {
                    links+="<div class='el el0' style='top:"+(_level*1.75+1.3)+"em;"+
                           "left:"+((_left+_node.left)*1.5+0.7)+"em;width:0em;'></div>";
                }
                for (var i in _node.children) {
                    var x = (_node.children[i].left+offset)<_node.left?_node.children[i].left+offset:_node.left;
                    var w = Math.abs(_node.children[i].left+offset-_node.left);
                    var c = "";
                    if (_node.children.length==1 || w==0) { c = " el1"; } else
                    if ((_node.children[i].left+offset)>_node.left) { c = " el2"; }
                    links+="<div class='el"+c+"' style='top:"+(_level*1.75+1.5)+"em;"+
                               "left:"+((_left+x)*1.5+0.7)+"em;width:"+(w*1.5)+"em;'></div>";
                    offset+=_node.children[i].width;
                }
                if (links) { settings.$ed.append(links); }
                _node.$html.css("top",(_level*1.75)+"em").css("left",((_left+_node.left)*1.5)+"em");

                // ROOT LEVEL
                if (_level==0) {
                    var ratio = Math.min(1,settings.size[0]/level,settings.size[1]/_node.width);
                    settings.$ed.css("font-size",ratio+"em");
                    var mx = ($this.width()-_node.$html.width()*_node.width*1.25)/2;
                    var my = ($this.height()-_node.$html.height()*(level+1)*1.45)/2;
                    settings.$ed.css("left",mx+"px").css("top",my+"px");

                    if (settings.onupdate) { settings.onupdate($this, settings.root); }
                }
                return level;
            },
            clear:function($this) {
                var settings = helpers.settings($this);
                settings.$ed.html("");
                if (settings.root&&settings.root.idx) { settings.root.detach(); } settings.root={};
                helpers.mathml($this);
                if (settings.onupdate) { settings.onupdate($this,false); }
            }
        },
        mathml: function($this, _node) {
            var settings = helpers.settings($this);
            if (!_node) { _node = settings.root; }

            var ret = _node.mathml?_node.mathml({nbdec: settings.nbdec, displaytype: settings.displaytype}):"";

            if ($(settings.mathml)) {
                if (ret.length) {
                    if (!_node.nomathml) {
                        $(settings.mathml).html("<div><math><mrow>"+ret+"</mrow></math></div>");
                            // TO IMPROVE THE WTF ALGORITHM
                        var ratio = $(settings.mathml).text().length;
                        if ($(settings.mathml).text().indexOf("/")!=-1) { ratio = ratio*0.7; }
                        ratio = ratio>5?Math.pow(0.65,Math.pow(ratio-5,0.45)):1;
                        $(settings.mathml+">div").css("font-size",ratio+"em");
                    }
                    else { $(settings.mathml).html(ret); }
                }
                else { $(settings.mathml).html(""); }
            }

            return ret;
        },
        text: function($this, _node) {
            var settings = helpers.settings($this), ret=[];
            if (!_node) { _node=settings.root; }
            if (_node.type=="op") {

                var val = _node.t, children = [], nb = 1;
                if (typeof(val)=="function") { val = _node.t(); }
                if (typeof(val)=="string")   { val = [val]; }

                for (var i in _node.children) {
                    var c = helpers.text($this,_node.children[i]);
                    nb = nb*c.length;
                    children.push(c);
                }

                for (var j in val) for (var i=0; i<nb; i++) {
                    var v = val[j];
                    var nbc = i;
                    for (var k in _node.children) {
                        var regexp = new RegExp("c"+k, "g");
                        v = v.replace(regexp, children[k][nbc%children[k].length]);
                        nbc = Math.floor(nbc/children[k].length);
                    }
                    ret.push(v);
                }
            }
            else {
                var tmp = _node.label({nbdec: settings.nbdec, displaytype: settings.displaytype, onlytext:true});
                ret = [tmp?tmp:""];
            }
            return ret;
        }
    };

    // The plugin
    $.fn.editor = function(method) {

        // public methods
        var methods = {
            init: function(options) {
                // The settings
                var settings = {
                    root            : {},
                    mathmlup        : { ratio: 1, timerid: 0, action:0 }
                };

                return this.each(function() {
                    var $this = $(this);

                    var $settings = $.extend(true, {}, defaults, options, settings);
                    helpers.settings($this, $settings);
                    $this.addClass("editor");

                    helpers.init($this);
                });
            },
            clear: function() { helpers.editor.clear($(this)); },
            value: function(_value, _add) {
                var $this = $(this), settings = helpers.settings($this),ret=0;
                if (_value) { if (_add) { helpers.editor.addroot($this, $.extend(true, {},_value)); }
                              else      { settings.root=helpers.editor.insert($this,true, $.extend(true, {},_value));
                                          helpers.editor.display($this); helpers.mathml($this); }
                            }
                else        { ret = settings.root.clone(); }
                return ret;
            },
            text: function() {  var $this = $(this), settings = helpers.settings($this); return helpers.text($(this)); },
            filled: function() {
                var $this = $(this), settings = helpers.settings($this);
                return settings.root.filled();
            },
            mathml: function(_val) {
                var $this = $(this), settings = helpers.settings($this);
                if (_val) { $(settings.mathml).addClass("s"); } else { $(settings.mathml).removeClass("s"); }
                helpers.mathml($(this),_val);
            },
            tonode: function(_val) {
                var $this = $(this), settings = helpers.settings($this), ret, val = $.extend(true, {}, _val);

                if (typeof(val.value)!="undefined")     { ret = {type:"value"}; }
                else                                    { ret = nodetype[val.id]; }
                if (!ret)                               { ret = settings.getnode?settings.getnode($this, val):{}; }

                ret = new helpers.node($.extend(true, val, ret));
                ret.children = [];
                for (var i in _val.children) { ret.children.push($this.editor("tonode", _val.children[i])); }

                return ret;
            }
        };

        if (methods[method])    { return methods[method].apply(this, Array.prototype.slice.call(arguments, 1)); } 
        else if (typeof method === 'object' || !method) { return methods.init.apply(this, arguments); }
        else { $.error( 'Method "' +  method + '" does not exist in editor plugin!'); }
    };
})(jQuery);
