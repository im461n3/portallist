// ==UserScript==
// @id             iitc-plugin-portals-list hack by @langs
// @name           IITC plugin: show list of portals
// @category       Info
// @version        0.3.0.20141119.235606
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://raw.githubusercontent.com/im461n3/portallist/master/portals-list.user.js
// @downloadURL    https://raw.githubusercontent.com/im461n3/portallist/master/portals-list.user.js
// @description    [hack-test-2014-11-19-235606] Display a sortable list of all visible portals with full details about the team, resonators, links, etc.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
    if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
    plugin_info.buildName = 'jonatkins-test';
    plugin_info.dateTimeVersion = '20141117.164706';
    plugin_info.pluginId = 'portals-list';
//END PLUGIN AUTHORS NOTE

// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.portalslist = function() {};

window.plugin.portalslist.listPortals = [];
window.plugin.portalslist.sortBy = 1; // second column: level
window.plugin.portalslist.sortOrder = -1;
window.plugin.portalslist.enlP = 0;
window.plugin.portalslist.resP = 0;
window.plugin.portalslist.neuP = 0;
window.plugin.portalslist.filter = 0;

/*
 * plugins may add fields by appending their specifiation to the following list. The following members are supported:
 * title: String
 *     Name of the column. Required.
 * value: function(portal)
 *     The raw value of this field. Can by anything. Required, but can be dummy implementation if sortValue and format
 *     are implemented.
 * sortValue: function(value, portal)
 *     The value to sort by. Optional, uses value if omitted. The raw value is passed as first argument.
 * sort: function(valueA, valueB, portalA, portalB)
 *     Custom sorting function. See Array.sort() for details on return value. Both the raw values and the portal objects
 *     are passed as arguments. Optional. Set to null to disable sorting
 * format: function(cell, portal, value)
 *     Used to fill and format the cell, which is given as a DOM node. If omitted, the raw value is put in the cell.
 * defaultOrder: -1|1
 *     Which order should by default be used for this column. -1 means descending. Default: 1
 */


window.plugin.portalslist.fields = [
  {
    title: "Portal Name",
    value: function(portal) { return portal.options.data.title; },
    sortValue: function(value, portal) { return value.toLowerCase(); },
    format: function(cell, portal, value) {
      $(cell)
        .append(plugin.portalslist.getPortalLink(portal))
        .addClass("portalTitle");
    }
  },
  {
    title: "Level",
    value: function(portal) { return portal.options.data.level; },
    format: function(cell, portal, value) {
      $(cell)
        .css('background-color', COLORS_LVL[value])
        .text('L' + value);
    },
    defaultOrder: -1,
  },
  {
    title: "Team",
    value: function(portal) { return portal.options.team; },
    format: function(cell, portal, value) {
      $(cell).text(['NEU', 'RES', 'ENL'][value]);
    }
  },
  {
    title: "Health",
    value: function(portal) { return portal.options.data.health; },
    sortValue: function(value, portal) { return portal.options.team===TEAM_NONE ? -1 : value; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(portal.options.team===TEAM_NONE ? '-' : value+'%');
    }
  },
  {
    title: "Res",
    value: function(portal) { return portal.options.data.resCount; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(value);
    }
  },
  {
    title: "Links",
    value: function(portal) { return window.getPortalLinks(portal.options.guid); },
    sortValue: function(value, portal) { return value.in.length + value.out.length; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .addClass('help')
        .attr('title', 'In:\t' + value.in.length + '\nOut:\t' + value.out.length)
        .text(value.in.length+value.out.length);
    }
  },
  {
    title: "Fields",
    value: function(portal) { return getPortalFieldsCount(portal.options.guid) },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(value);
    }
  },
  {
    title: "AP",
    value: function(portal) {
      var links = window.getPortalLinks(portal.options.guid);
      var fields = getPortalFieldsCount(portal.options.guid);
      return portalApGainMaths(portal.options.data.resCount, links.in.length+links.out.length, fields);
    },
    sortValue: function(value, portal) { return value.enemyAp; },
    format: function(cell, portal, value) {
      var title = '';
      if (PLAYER.team == portal.options.data.team) {
        title += 'Friendly AP:\t'+value.friendlyAp+'\n'
               + '- deploy '+(8-portal.options.data.resCount)+' resonator(s)\n'
               + '- upgrades/mods unknown\n';
      }
      title += 'Enemy AP:\t'+value.enemyAp+'\n'
             + '- Destroy AP:\t'+value.destroyAp+'\n'
             + '- Capture AP:\t'+value.captureAp;

      $(cell)
        .addClass("alignR")
        .addClass('help')
        .prop('title', title)
        .html(digits(value.enemyAp));
    }
  },
];

//fill the listPortals array with portals avaliable on the map (level filtered portals will not appear in the table)
window.plugin.portalslist.getPortals = function() {
  //filter : 0 = All, 1 = Neutral, 2 = Res, 3 = Enl, -x = all but x
  var retval=false;

  var displayBounds = map.getBounds();

  window.plugin.portalslist.listPortals = [];
  $.each(window.portals, function(i, portal) {
    // eliminate offscreen portals (selected, and in padding)
    if(!displayBounds.contains(portal.getLatLng())) return true;

    retval=true;

    switch (portal.options.team) {
      case TEAM_RES:
        window.plugin.portalslist.resP++;
        break;
      case TEAM_ENL:
        window.plugin.portalslist.enlP++;
        break;
      default:
        window.plugin.portalslist.neuP++;
    }

    // cache values and DOM nodes
    var obj = { portal: portal, values: [], sortValues: [] };

    var row = document.createElement('tr');
    row.className = TEAM_TO_CSS[portal.options.team];
    obj.row = row;

    var cell = row.insertCell(-1);
    cell.className = 'alignR';

    window.plugin.portalslist.fields.forEach(function(field, i) {
      cell = row.insertCell(-1);

      var value = field.value(portal);
      obj.values.push(value);

      obj.sortValues.push(field.sortValue ? field.sortValue(value, portal) : value);

      if(field.format) {
        field.format(cell, portal, value);
      } else {
        cell.textContent = value;
      }
    });

    window.plugin.portalslist.listPortals.push(obj);
  });

  return retval;
}

window.plugin.portalslist.displayPL = function() {
  var list;
  window.plugin.portalslist.sortBy = 1;
  window.plugin.portalslist.sortOrder = -1;
  window.plugin.portalslist.enlP = 0;
  window.plugin.portalslist.resP = 0;
  window.plugin.portalslist.neuP = 0;
  window.plugin.portalslist.filter = 0;

  if (window.plugin.portalslist.getPortals()) {
    list = window.plugin.portalslist.portalTable(window.plugin.portalslist.sortBy, window.plugin.portalslist.sortOrder,window.plugin.portalslist.filter);
  } else {
    list = $('<table class="noPortals"><tr><td>Nothing to show!</td></tr></table>');
  };

  if(window.useAndroidPanes()) {
    $('<div id="portalslist" class="mobile">').append(list).appendTo(document.body);
  } else {
    dialog({
      html: $('<div id="portalslist">').append(list),
      dialogClass: 'ui-dialog-portalslist',
      title: 'Portal list: ' + window.plugin.portalslist.listPortals.length + ' ' + (window.plugin.portalslist.listPortals.length == 1 ? 'portal' : 'portals'),
      id: 'portal-list',
      width: 700
    });
  }
}

window.plugin.portalslist.portalTable = function(sortBy, sortOrder, filter) {
  // save the sortBy/sortOrder/filter
  window.plugin.portalslist.sortBy = sortBy;
  window.plugin.portalslist.sortOrder = sortOrder;
  window.plugin.portalslist.filter = filter;

  var portals = window.plugin.portalslist.listPortals;
  var sortField = window.plugin.portalslist.fields[sortBy];

  portals.sort(function(a, b) {
    var valueA = a.sortValues[sortBy];
    var valueB = b.sortValues[sortBy];

    if(sortField.sort) {
      return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
    }

    return sortOrder *
      (valueA < valueB ? -1 :
      valueA > valueB ?  1 :
      0);
  });

  if(filter !== 0) {
    portals = portals.filter(function(obj) {
      return filter < 0
        ? obj.portal.options.team+1 != -filter
        : obj.portal.options.team+1 == filter;
    });
  }

  var table, row, cell;
  var container = $('<div>');

  table = document.createElement('table');
  table.className = 'filter';
  container.append(table);

  row = table.insertRow(-1);

  var length = window.plugin.portalslist.listPortals.length;

  ["All", "Neutral", "Resistance", "Enlightened"].forEach(function(label, i) {
    cell = row.appendChild(document.createElement('th'));
    cell.className = 'filter' + label.substr(0, 3);
    cell.textContent = label+':';
    cell.title = 'Show only portals of this color';
    $(cell).click(function() {
      $('#portalslist').empty().append(window.plugin.portalslist.portalTable(sortBy, sortOrder, i));
    });


    cell = row.insertCell(-1);
    cell.className = 'filter' + label.substr(0, 3);
    if(i !== 0) cell.title = 'Hide portals of this color';
    $(cell).click(function() {
      $('#portalslist').empty().append(window.plugin.portalslist.portalTable(sortBy, sortOrder, -i));
    });

    switch(i-1) {
      case -1:
        cell.textContent = length;
        break;
      case 0:
        cell.textContent = window.plugin.portalslist.neuP + ' (' + Math.round(window.plugin.portalslist.neuP/length*100) + '%)';
        break;
      case 1:
        cell.textContent = window.plugin.portalslist.resP + ' (' + Math.round(window.plugin.portalslist.resP/length*100) + '%)';
        break;
      case 2:
        cell.textContent = window.plugin.portalslist.enlP + ' (' + Math.round(window.plugin.portalslist.enlP/length*100) + '%)';
    }
  });

  table = document.createElement('table');
  table.className = 'portals';
  container.append(table);

  var thead = table.appendChild(document.createElement('thead'));
  row = thead.insertRow(-1);

  cell = row.appendChild(document.createElement('th'));
  cell.textContent = '#';

  window.plugin.portalslist.fields.forEach(function(field, i) {
    cell = row.appendChild(document.createElement('th'));
    cell.textContent = field.title;
    if(field.sort !== null) {
      cell.classList.add("sortable");
      if(i == window.plugin.portalslist.sortBy) {
        cell.classList.add("sorted");
      }

      $(cell).click(function() {
        var order;
        if(i == sortBy) {
          order = -sortOrder;
        } else {
          order = field.defaultOrder < 0 ? -1 : 1;
        }

        $('#portalslist').empty().append(window.plugin.portalslist.portalTable(i, order, filter));
      });
    }
  });

  portals.forEach(function(obj, i) {
    var row = obj.row
    if(row.parentNode) row.parentNode.removeChild(row);

    row.cells[0].textContent = i+1;

    table.appendChild(row);
  });

  container.append('<div class="disclaimer">Click on portals table headers to sort by that column. '
    + 'Click on <b>All, Neutral, Resistance, Enlightened</b> to only show portals owner by that faction or on the number behind the factions to show all but those portals.</div>');


  //by langs
  var html='';
  var stamp = new Date().getTime();

  html+='<div><aside><a download="Ingress Export.csv" href="' + window.plugin.portalslist.export('csv') + '">Export as .csv</a></aside>'
      +'<aside><a download="Ingress Export.kml" href="' + window.plugin.portalslist.export('kml') + '">Export as .kml</a></aside>'
      + '</div>';
  container.append(html);

  return container;
}

// portal link - single click: select portal
//               double click: zoom to and select portal
// code from getPortalLink function by xelio from iitc: AP List - https://raw.github.com/breunigs/ingress-intel-total-conversion/gh-pages/plugins/ap-list.user.js
window.plugin.portalslist.getPortalLink = function(portal) {
  var coord = portal.getLatLng();
  var perma = '/intel?ll='+coord.lat+','+coord.lng+'&z=17&pll='+coord.lat+','+coord.lng;

  // jQuery's event handlers seem to be removed when the nodes are remove from the DOM
  var link = document.createElement("a");
  link.textContent = portal.options.data.title;
  link.href = perma;
  link.addEventListener("click", function(ev) {
    renderPortalDetails(portal.options.guid);
    ev.preventDefault();
    return false;
  }, false);
  link.addEventListener("dblclick", function(ev) {
    zoomToAndShowPortal(portal.options.guid, [coord.lat, coord.lng]);
    ev.preventDefault();
    return false;
  });
  return link;
}

window.plugin.portalslist.onPaneChanged = function(pane) {
  if(pane == "plugin-portalslist")
    window.plugin.portalslist.displayPL();
  else
    $("#portalslist").remove()
};

var setup =  function() {
  if(window.useAndroidPanes()) {
    android.addPane("plugin-portalslist", "Portals list", "ic_action_paste");
    addHook("paneChanged", window.plugin.portalslist.onPaneChanged);
  } else {
    $('#toolbox').append(' <a onclick="window.plugin.portalslist.displayPL()" title="Display a list of portals in the current view">Portals list</a>');
  }

  $("<style>")
    .prop("type", "text/css")
    .html("#portalslist.mobile {\n  background: transparent;\n  border: 0 none !important;\n  height: 100% !important;\n  width: 100% !important;\n  left: 0 !important;\n  top: 0 !important;\n  position: absolute;\n  overflow: auto;\n}\n\n#portalslist table {\n  margin-top: 5px;\n  border-collapse: collapse;\n  empty-cells: show;\n  width: 100%;\n  clear: both;\n}\n\n#portalslist table td, #portalslist table th {\n  background-color: #1b415e;\n  border-bottom: 1px solid #0b314e;\n  color: white;\n  padding: 3px;\n}\n\n#portalslist table th {\n  text-align: center;\n}\n\n#portalslist table .alignR {\n  text-align: right;\n}\n\n#portalslist table.portals td {\n  white-space: nowrap;\n}\n\n#portalslist table th.sortable {\n  cursor: pointer;\n}\n\n#portalslist table .portalTitle {\n  min-width: 120px !important;\n  max-width: 240px !important;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n#portalslist .sorted {\n  color: #FFCE00;\n}\n\n#portalslist table.filter {\n  table-layout: fixed;\n  cursor: pointer;\n  border-collapse: separate;\n  border-spacing: 1px;\n}\n\n#portalslist table.filter th {\n  text-align: left;\n  padding-left: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#portalslist table.filter td {\n  text-align: right;\n  padding-right: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#portalslist .filterNeu {\n  background-color: #666;\n}\n\n#portalslist table tr.res td, #portalslist .filterRes {\n  background-color: #005684;\n}\n\n#portalslist table tr.enl td, #portalslist .filterEnl {\n  background-color: #017f01;\n}\n\n#portalslist table tr.none td {\n  background-color: #000;\n}\n\n#portalslist .disclaimer {\n  margin-top: 10px;\n  font-size: 10px;\n}\n\n#portalslist.mobile table.filter tr {\n  display: block;\n  text-align: center;\n}\n#portalslist.mobile table.filter th, #portalslist.mobile table.filter td {\n  display: inline-block;\n  width: 22%;\n}\n\n")
    .appendTo("head");

}

//add export feature
//by langs
window.plugin.portalslist.export = function(fileformat){
    //alert('format :' + fileformat);
    var file = '';
    var uri = '';

    switch (fileformat) {
        case 'csv':
            file = window.plugin.portalslist.exportCSV(window.plugin.portalslist.sortBy, window.plugin.portalslist.sortOrder,window.plugin.portalslist.filter);
            break;
        case 'kml':
            file = window.plugin.portalslist.exportKML(window.plugin.portalslist.sortBy, window.plugin.portalslist.sortOrder,window.plugin.portalslist.filter);
            break;
    }

    if (file !== '') {
        //http://stackoverflow.com/questions/4639372/export-to-csv-in-jquery
        var uri = 'data:text/' + fileformat + ';charset=UTF-8,' + encodeURIComponent(file);
        //window.open(uri);
    }
    return uri;
}
window.plugin.portalslist.exportCSV = function(sortBy, sortOrder, filter){
    // save the sortBy/sortOrder/filter
    window.plugin.portalslist.sortBy = sortBy;
    window.plugin.portalslist.sortOrder = sortOrder;
    window.plugin.portalslist.filter = filter;

    var portals = window.plugin.portalslist.listPortals;
    var sortField = window.plugin.portalslist.fields[sortBy];
    var csv = '';
    var team = ['NEU', 'RES', 'ENL'];

    //fixes china coor
    var latlng = window.plugin.fixChinaOffset.WGS84transformer.prototype.transform(obj.portal._latlng.lat, obj.portal._latlng.lng);

    portals.sort(function(a, b) {
        var valueA = a.sortValues[sortBy];
        var valueB = b.sortValues[sortBy];

        if(sortField.sort) {
            return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
        }

        return sortOrder *
            (valueA < valueB ? -1 :
                    valueA > valueB ?  1 :
                0);
    });

    if(filter !== 0) {
        portals = portals.filter(function(obj) {
            return filter < 0
                ? obj.portal.options.team+1 != -filter
                : obj.portal.options.team+1 == filter;
        });
    }

    //headers
    csv += 'Portal\tLevel\tTeam\tEnergy\tRes\tLinks\tFields\tAP Gain\tlat\tlong\tPortal link\n';

    portals.forEach(function(obj, i) {
        csv += obj.sortValues[0]+'\t';
        csv += obj.sortValues[1]+'\t';
        csv += team[obj.sortValues[2]]+'\t';
        csv += obj.sortValues[3]+'\t';
        csv += obj.sortValues[4]+'\t';
        csv += obj.sortValues[5]+'\t';
        csv += obj.sortValues[6]+'\t';
        csv += obj.sortValues[7]+'\t';
        csv += latlng.lat+'\t';
        csv += latlng.lng+'\t';
        csv += 'https://www.ingress.com/intel?ll='+obj.portal._latlng.lat+','+obj.portal._latlng.lng+'&z=17&pll='+obj.portal._latlng.lat+','+obj.portal._latlng.lng;
        csv += '\n';
    })

    return csv;
}

    window.plugin.portalslist.exportKML = function(sortBy, sortOrder, filter){
        // save the sortBy/sortOrder/filter
        window.plugin.portalslist.sortBy = sortBy;
        window.plugin.portalslist.sortOrder = sortOrder;
        window.plugin.portalslist.filter = filter;

        // all portals informations are avalaible in the listPortals array
        var portals = window.plugin.portalslist.listPortals;
        var sortField = window.plugin.portalslist.fields[sortBy];
        var kml = '';
        var team = ['NEU', 'RES', 'ENL'];

        portals.sort(function(a, b) {
            var valueA = a.sortValues[sortBy];
            var valueB = b.sortValues[sortBy];

            if(sortField.sort) {
                return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
            }

            return sortOrder *
                (valueA < valueB ? -1 :
                        valueA > valueB ?  1 :
                    0);
        });

        if(filter !== 0) {
            portals = portals.filter(function(obj) {
                return filter < 0
                    ? obj.portal.options.team+1 != -filter
                    : obj.portal.options.team+1 == filter;
            });
        }

        //headers
        kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n'
            + '<name>Ingress Export</name><description><![CDATA[Ingress Portals\nExported from IITC using the Portals-list plugin\n' + new Date().toLocaleString() + ']]></description>';

        // define colored markers as style0 (neutral), style1 (Resistance), style2 (Enlight)
        kml += '<Style id="style1"><IconStyle><Icon><href>http://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png</href></Icon></IconStyle></Style>'
            + '<Style id="style2"><IconStyle><Icon><href>http://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png</href></Icon></IconStyle></Style>'
            + '<Style id="style0"><IconStyle><Icon><href>http://maps.gstatic.com/mapfiles/ms2/micons/pink-dot.png</href></Icon></IconStyle></Style>\n';

        portals.forEach(function(obj, i) {
            // add the portal in the kml file only if part of the filter choice
            // description contain picture of the portal, address and link to the Intel map
            // fixes china coor
            var latlng = window.plugin.fixChinaOffset.WGS84transformer.prototype.transform(obj.portal._latlng.lat, obj.portal._latlng.lng);
            var description = '<![CDATA['
                + '<div><table><tr><td><img style="width:100px" src="' + obj.portal.options.data.image + '"></td><td>'
                + '<br><a href="https://ingress.com/intel?latE6=' + obj.portal._latlng.lat*1E6 + '&lngE6=' + obj.portal._latlng.lng*1E6 + '&z=17">Link to Intel Map</a></td></tr></table>'
                + ']]>';

            kml += '<Placemark><name>L' + Math.floor(obj.sortValues[1]) + ' - ' + obj.sortValues[0] + '</name>'
                + '<description>' +  description + '</description>'
                + '<styleUrl>#style' + team[obj.sortValues[2]] + '</styleUrl>';

            //coordinates
            kml += '<Point><coordinates>' + latlng.lng + ',' + latlng.lat + ',0</coordinates></Point>';
            kml += '</Placemark>\n';
        });
        kml += '</Document></kml>';
        return kml;
    }



// PLUGIN END //////////////////////////////////////////////////////////

setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
