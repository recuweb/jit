$jit.Sunburst.Plot.NodeTypes.implement({
  'piechart-stacked' : {
    'render' : function(node, canvas) {
      var pos = node.pos.getp(true),
          dimArray = node.getData('dimArray'),
          valueArray = node.getData('valueArray'),
          colorArray = node.getData('colorArray'),
          colorLength = colorArray.length,
          stringArray = node.getData('stringArray'),
          span = node.getData('span') / 2,
          theta = node.pos.theta,
          begin = theta - span,
          end = theta + span,
          polar = new Polar;
    
      var ctx = canvas.getCtx(), 
          opt = {},
          gradient = node.getData('gradient'),
          border = node.getData('border'),
          config = node.getData('config'),
          showLabels = config.showLabels,
          resizeLabels = config.resizeLabels,
          label = config.Label;

      var xpos = config.sliceOffset * Math.cos((begin + end) /2);
      var ypos = config.sliceOffset * Math.sin((begin + end) /2);

      if (colorArray && dimArray && stringArray) {
        for (var i=0, l=dimArray.length, acum=0, valAcum=0; i<l; i++) {
          var dimi = dimArray[i], colori = colorArray[i % colorLength];
          ctx.fillStyle = ctx.strokeStyle = colori;
          if(gradient && dimi) {
            var radialGradient = ctx.createRadialGradient(xpos, ypos, acum + config.sliceOffset,
                xpos, ypos, acum + dimi + config.sliceOffset);
            var colorRgb = $.hexToRgb(colori), 
                ans = $.map(colorRgb, function(i) { return (i * 0.8) >> 0; }),
                endColor = $.rgbToHex(ans);

            radialGradient.addColorStop(0, colori);
            radialGradient.addColorStop(0.5, colori);
            radialGradient.addColorStop(1, endColor);
            ctx.fillStyle = radialGradient;
          }
          
          polar.rho = acum + config.sliceOffset;
          polar.theta = begin;
          var p1coord = polar.getc(true);
          polar.theta = end;
          var p2coord = polar.getc(true);
          polar.rho += dimi;
          var p3coord = polar.getc(true);
          polar.theta = begin;
          var p4coord = polar.getc(true);

          ctx.beginPath();
          //fixing FF arc method + fill
          ctx.arc(xpos, ypos, acum + .01, begin, end, false);
          ctx.arc(xpos, ypos, acum + dimi + .01, end, begin, true);
          ctx.fill();
          if(border && border.name == stringArray[i]) {
            opt.acum = acum;
            opt.dimValue = dimArray[i];
            opt.begin = begin;
            opt.end = end;
          }
          acum += (dimi || 0);
          valAcum += (valueArray[i] || 0);
        }
        if(border) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.lineWidth = 2;
          ctx.strokeStyle = border.color;
          var s = begin < end? 1 : -1;
          ctx.beginPath();
          //fixing FF arc method + fill
          ctx.arc(xpos, ypos, opt.acum + .01 + 1, opt.begin, opt.end, false);
          ctx.arc(xpos, ypos, opt.acum + opt.dimValue + .01 - 1, opt.end, opt.begin, true);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        if(showLabels) {
          ctx.save();
          ctx.fillStyle = ctx.strokeStyle = label.color;
          var scale = resizeLabels? node.getData('normalizedDim') : 1,
              fontSize = (label.size * scale) >> 0;
          fontSize = fontSize < +resizeLabels? +resizeLabels : fontSize;
          
          ctx.font = fontSize + 'px ' + label.family;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          
          polar.rho = acum + config.labelOffset + config.sliceOffset;
          polar.theta = node.pos.theta;
          var cart = polar.getc(true);
          
          ctx.fillText(node.name, cart.x, cart.y);
          ctx.restore();
        }
      }
    },
    'contains': function(node, pos) {
      if (this.nodeTypes['none'].anglecontains.call(this, node, pos)) {
        var rho = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        var ld = this.config.levelDistance, d = node._depth;
        var config = node.getData('config');
        if(rho <=ld * d + config.sliceOffset) {
          var dimArray = node.getData('dimArray');
          for(var i=0,l=dimArray.length,acum=config.sliceOffset; i<l; i++) {
            var dimi = dimArray[i];
            if(rho >= acum && rho <= acum + dimi) {
              return {
                name: node.getData('stringArray')[i],
                color: node.getData('colorArray')[i],
                value: node.getData('valueArray')[i],
                label: node.name
              };
            }
            acum += dimi;
          }
        }
        return false;
        
      }
      return false;
    }
  }
});

$jit.PieChart = new Class({
  sb: null,
  colors: ["#416D9C", "#70A35E", "#EBB056", "#C74243", "#83548B", "#909291", "#557EAA"],
  selected: {},
  busy: false,
  
  initialize: function(opt) {
    this.controller = this.config = 
      $.merge(Options("Canvas", "PieChart", "Label"), opt);
    this.initializeViz();
  },
  
  initializeViz: function() {
    var config = this.config, that = this;
    var nodeType = config.type.split(":")[0];
    var sb = new $jit.Sunburst({
      injectInto: config.injectInto,
      useCanvas: config.useCanvas,
      withLabels: false,
      Label: {
        type: 'Native'
      },
      Node: {
        overridable: true,
        type: 'piechart-' + nodeType,
        width: 1,
        height: 1
      },
      Edge: {
        type: 'none'
      },
      Tips: {
        enable: config.Tips.enable,
        force: true,
        onShow: function(tip, node, contains) {
          var elem = contains;
          config.Tips.onShow(tip, elem, node);
          that.select(node.id, elem.name, elem.index);
        },
        onHide: function() {
          that.select(false, false, false);
        }
      }
    });
    
    var size = sb.canvas.getSize(),
        min = Math.min;
    sb.config.levelDistance = min(size.width, size.height)/2 
      - config.offset - config.sliceOffset;
    this.sb = sb;
    this.canvas = this.sb.canvas;
  },
  
  loadJSON: function(json) {
    var prefix = $.time(), 
        ch = [], 
        sb = this.sb,
        name = $.splat(json.label),
        nameLength = name.length,
        color = $.splat(json.color || this.colors),
        colorLength = color.length,
        config = this.config,
        gradient = !!config.type.split(":")[1],
        animate = config.animate,
        mono = nameLength == 1;
    
    for(var i=0, values=json.values, l=values.length; i<l; i++) {
      var val = values[i];
      var valArray = $.splat(val.values);
      ch.push({
        'id': prefix + val.label,
        'name': val.label,
        'data': {
          'value': valArray,
          '$valueArray': valArray,
          '$colorArray': mono? $.splat(color[i % colorLength]) : color,
          '$stringArray': name,
          '$gradient': gradient,
          '$config': config,
          '$angularWidth': $.reduce(valArray, function(x,y){return x+y;})
        },
        'children': []
      });
    }
    var root = {
      'id': prefix + '$root',
      'name': '',
      'data': {
        '$type': 'none',
        '$width': 1,
        '$height': 1
      },
      'children': ch
    };
    sb.loadJSON(root);
    
    this.normalizeDims();
    sb.refresh();
    if(animate) {
      sb.fx.animate({
        modes: ['node-property:dimArray'],
        duration:1500
      });
    }
  },
  
  updateJSON: function(json, onComplete) {
    if(this.busy) return;
    this.busy = true;
    
    var sb = this.sb;
    var graph = sb.graph;
    var values = json.values;
    var animate = this.config.animate;
    var that = this;
    $.each(values, function(v) {
      var n = graph.getByName(v.label),
          vals = $.splat(v.values);
      if(n) {
        n.setData('valueArray', vals);
        n.setData('angularWidth', $.reduce(vals, function(x,y){return x+y;}));
      }
    });
    this.normalizeDims();
    if(animate) {
      sb.compute('end');
      sb.fx.animate({
        modes: ['node-property:dimArray:span', 'linear'],
        duration:1500,
        onComplete: function() {
          that.busy = false;
          onComplete && onComplete.onComplete();
        }
      });
    } else {
      sb.refresh();
    }
  },
    
  //adds the little brown bar when hovering the node
  select: function(id, name) {
    if(!this.config.hoveredColor) return;
    var s = this.selected;
    if(s.id != id || s.name != name) {
      s.id = id;
      s.name = name;
      s.color = this.config.hoveredColor;
      $jit.Graph.Util.eachNode(this.sb.graph, function(n) {
        if(id == n.id) {
          n.setData('border', s);
        } else {
          n.setData('border', false);
        }
      });
      this.sb.plot();
    }
  },
  
  getLegend: function() {
    var legend = {};
    var n;
    $jit.Graph.Util.eachAdjacency(this.sb.graph.getNode(this.sb.root), function(adj) {
      n = adj.nodeTo;
    });
    var colors = n.getData('colorArray'),
        len = colors.length;
    $.each(n.getData('stringArray'), function(s, i) {
      legend[s] = colors[i % len];
    });
    return legend;
  },
  
  getMaxValue: function() {
    var maxValue = 0;
    $jit.Graph.Util.eachNode(this.sb.graph, function(n) {
      var valArray = n.getData('valueArray'),
          acum = 0;
      $.each(valArray, function(v) { 
        acum += +v;
      });
      maxValue = maxValue>acum? maxValue:acum;
    });
    return maxValue;
  },
  
  normalizeDims: function() {
    //number of elements
    var root = this.sb.graph.getNode(this.sb.root), l=0;
    $jit.Graph.Util.eachAdjacency(root, function() {
      l++;
    });
    var maxValue = this.getMaxValue(),
        config = this.config,
        animate = config.animate,
        rho = this.sb.config.levelDistance;
    $jit.Graph.Util.eachNode(this.sb.graph, function(n) {
      var acum = 0, animateValue = [];
      $.each(n.getData('valueArray'), function(v) {
        acum += +v;
        animateValue.push(0);
      });
      var stat = (animateValue.length == 1) && !config.updateHeights;
      if(animate) {
        n.setData('dimArray', $.map(n.getData('valueArray'), function(n) { 
          return stat? rho: (n * rho / maxValue); 
        }), 'end');
        var dimArray = n.getData('dimArray');
        if(!dimArray) {
          n.setData('dimArray', animateValue);
        }
      } else {
        n.setData('dimArray', $.map(n.getData('valueArray'), function(n) { 
          return stat? rho : (n * rho / maxValue); 
        }));
      }
      n.setData('normalizedDim', acum / maxValue);
    });
  }
});