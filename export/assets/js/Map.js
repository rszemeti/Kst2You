var gridLines = [];
var circles=[];
var gridAnnotations = [];
var smallAnnotations = [];
var gridActive=false;
var circlesActive=true;
var mapJsLoaded = false;

function initMap(){
    mapJsLoaded = true;
}

// Wait until all the map JS is loaded before trying to draw a map
function drawMap() {
    if (!mapJsLoaded) {
        let intervalId = setInterval(() => {
            if (mapJsLoaded) {
                clearInterval(intervalId); 
                _DrawMap(); // The actual logic to draw the map
            }
        }, 100); // Check every 100 milliseconds
    } else {
        _DrawMap();
    }
}

function _DrawMap() {
  $('#map').empty();

  var qth = {
    lat: myLatLong[0],
    lng: myLatLong[1]
  };

  map = new google.maps.Map(
    document.getElementById('map'), {
      zoom: 6,
      center: qth,
      gestureHandling: 'greedy',
      mapTypeId: "terrain",
    });

  google.maps.event.addListener(map, "dblclick", function(event) {
    var lat = event.latLng.lat();
    var lng = event.latLng.lng();
    var gs = latLonToGridSquare(lat, lng);
    newLocation = {
      lat: lat,
      lng: lng,
      gs: gs
    };
    showProfile({
      lat: myLatLong[0],
      lng: myLatLong[1]
    }, newLocation);
    // populate yor box/field with lat, lng
    $('#currentLat').text(degToDegMin(lat) + ((lat > 0) ? " N" : " S"));
    $('#currentLng').text(degToDegMin(Math.abs(lng)) + ((lng > 0 ? "  E" : " W")));
    $('#currentGrid').text(gs);
    let dist = distVincenty(myLatLong[0], myLatLong[1], lat, lng) / 1000;
    let brg = bearing(myLatLong[0], myLatLong[1], lat, lng);
    $('#arbitaryDistBearing').text(Math.round(dist)+"km/"+Math.round(brg)+'°');
    $('#locationModal').modal('show');
    // Prevent the default right-click context menu from appearing
    if (event.preventDefault) {
      event.preventDefault();
    } else {
      // For older browsers that do not support preventDefault
      event.returnValue = false;
    }
    return false;
  });

  google.maps.event.addListener(map, "rightclick", function(event) {
    var lat = event.latLng.lat();
    var lng = event.latLng.lng();
    var gs = latLonToGridSquare(lat, lng);
    newLocation = {
      lat: lat,
      lng: lng,
      gs: gs
    };
    showProfile({
      lat: myLatLong[0],
      lng: myLatLong[1]
    }, newLocation);
    // Prevent the default right-click context menu from appearing
    if (event.preventDefault) {
      event.preventDefault();
    } else {
      // For older browsers that do not support preventDefault
      event.returnValue = false;
    }
    return false;
  });

  google.maps.event.addListener(map, 'idle', function() {
    drawGridLines();
  });

  var marker = new google.maps.Marker({
    position: qth,
    map: map,
    title: 'QTH'
  });
  drawCircles();
}

function drawCircles(){
   var qth = {
    lat: myLatLong[0],
    lng: myLatLong[1]
  };
  addCircle(qth, 100);
  addCircle(qth, 200);
  addCircle(qth, 300);
  addCircle(qth, 500);
  addCircle(qth, 1000);
}

function clearCircles() {
  for (let c of circles) {
    c.setMap(null); // Remove the line from the map
  }
  circles.length = 0; // Clear the array
}

// Function to delete all markers from the map
function deleteAllMapMarkers() {
  for (var key in stationList) {
    if (stationList.hasOwnProperty(key) && stationList[key].marker) {
      stationList[key].marker.setMap(null); // Remove the marker from the map
    }
  }
}

function setGridOn(){
    gridActive=true;
    $("#gridButton").addClass('active');
    drawGridLines();
}

function setGridOff(){
    gridActive=false;
    $("#gridButton").removeClass('active');
    clearGridLines();
    clearAnnotations();
    clearSmallAnnotations();
}

function setCirclesOn(){
    circlesActive=true;
    $("#circlesButton").addClass('active');
    drawCircles();
}

function setCirclesOff(){
    circlesActive=false;
    $("#circlesButton").removeClass('active');
    clearCircles();
}

function clearGridLines() {
  for (let line of gridLines) {
    line.setMap(null); // Remove the line from the map
  }
  gridLines.length = 0; // Clear the array
}

function clearAnnotations() {
  for (let i = 0; i < gridAnnotations.length; i++) {
    gridAnnotations[i].setMap(null);
  }
  gridAnnotations = [];
}

function clearSmallAnnotations() {
  for (let i = 0; i < smallAnnotations.length; i++) {
    smallAnnotations[i].setMap(null);
  }
  smallAnnotations = [];
}


function drawGridLines() {
  if(! gridActive){
      return;
  }
  const zoomLevel = map.getZoom();
  console.log("grid zoomLevel: " + zoomLevel);


  let granularity;
  if (zoomLevel > 8) {
    granularity = 6; // "IO" level
  } else if (zoomLevel > 4) {
    granularity = 4; // "IO81" level
    clearGridLines();
    clearAnnotations();
  } else {
    granularity = 2; // "IO81AA" level
    clearGridLines();
    clearAnnotations();
  }

  console.log("grid zoomLevel: " + granularity);
  let latSpacing, lngSpacing;

  switch (granularity) {
    case 2:
      latSpacing = 10;
      lngSpacing = 20;
      break;
    case 4:
      latSpacing = 1;
      lngSpacing = 2;
      break;
    case 6:
      latSpacing = 1.0 / 24.0; // 1/24 degrees for more refined grid
      lngSpacing = 1.0 / 12.0; // 1/12 degrees for more refined grid
      break;
    default:
      return;
  }

  const bounds = map.getBounds();
  const ne = bounds.getNorthEast(); // Top-right corner of the visible map
  const sw = bounds.getSouthWest(); // Bottom-left corner of the visible map

  // Calculate starting and ending points for the grid lines
  const startLat = Math.floor(sw.lat() / latSpacing) * latSpacing;
  const endLat = Math.ceil(ne.lat() / latSpacing) * latSpacing;
  const startLng = Math.floor(sw.lng() / lngSpacing) * lngSpacing;
  const endLng = Math.ceil(ne.lng() / lngSpacing) * lngSpacing;

  let horizontalLines = [];
  let verticalLines = [];

  // Draw vertical grid lines (constant longitude)
  for (let lng = startLng; lng <= endLng; lng += lngSpacing) {
    verticalLines.push(lng);
    const path = [{
        lat: startLat,
        lng: lng
      },
      {
        lat: endLat,
        lng: lng
      }
    ];
    drawLine(path, granularity);
  }

  // Draw horizontal grid lines (constant latitude)
  for (let lat = startLat; lat <= endLat; lat += latSpacing) {
    horizontalLines.push(lat);
      const path1 = [{
          lat: lat,
          lng: 0.0
        },
        {
          lat: lat,
          lng: 179.999
        }
      ];
      drawLine(path1, granularity);

      const path2 = [{
          lat: lat,
          lng: -179.999
        },
        {
          lat: lat,
          lng: 0.0
        }
      ];
      drawLine(path2, granularity);
  }
  const visibleSquares = getCornersFromGridLines(horizontalLines, verticalLines);
  if (visibleSquares.length < 150) {
    visibleSquares.forEach(square => {
      annotateCenterOfSquare(square, granularity);
    });
  } else {
    clearSmallAnnotations();
  }
}

function annotateCenterOfSquare(square, granularity) {
  if (granularity === 6) {
    //return;
  }

  const centerLat = (square.southwest.lat + square.northeast.lat) / 2;
  const centerLng = (square.southwest.lng + square.northeast.lng) / 2;
  const gridLocator = latLonToGridSquare(centerLat, centerLng);

  const annotationText = gridLocator.substr(0, granularity);

  // Add the text to the map (you might use google maps Marker or InfoWindow for this)
  var txtSz = "1.5em";
  if(granularity==6){
      txtSz="1.2em";
  }
  const annotation = new google.maps.Marker({
    position: {
      lat: centerLat,
      lng: centerLng
    },
    map: map,
    label: {
      text: annotationText,
      color: '#F00',
      fontSize: txtSz,
      fontWeight: "bold"
    },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 0, // makes the default marker invisible
      strokeWeight: 0, // removes the border of the invisible marker
    },
    draggable: false
  });
  if (granularity < 6) {
    gridAnnotations.push(annotation);
  } else {
    smallAnnotations.push(annotation);
  }

}

function getCornersFromGridLines(horizontalLines, verticalLines) {
  let squares = [];

  for (let i = 0; i < horizontalLines.length - 1; i++) {
    for (let j = 0; j < verticalLines.length - 1; j++) {
      const southwest = {
        lat: horizontalLines[i],
        lng: verticalLines[j]
      };
      const northwest = {
        lat: horizontalLines[i + 1],
        lng: verticalLines[j]
      };
      const northeast = {
        lat: horizontalLines[i + 1],
        lng: verticalLines[j + 1]
      };
      const southeast = {
        lat: horizontalLines[i],
        lng: verticalLines[j + 1]
      };

      squares.push({
        southwest,
        northwest,
        northeast,
        southeast
      });
    }
  }

  return squares;
}

function drawLine(path, granularity) {
  if (granularity < 6) {
    const line = new google.maps.Polyline({
      path: path,
      geodesic: false,
      strokeColor: "#FF0000",
      strokeOpacity: 0.5,
      strokeWeight: 2,
      map: map
    });
    gridLines.push(line);
  } else {
    const line = new google.maps.Polyline({
      path: path,
      geodesic: false,
      strokeColor: "#993333",
      strokeOpacity: 0.3,
      strokeWeight: 0.8,
      map: map
    });
    gridLines.push(line);
  }
}

function addCircle(qth, radius) {
  let c = new google.maps.Circle({
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 1,
    fillColor: '#FF0000',
    fillOpacity: 0.0,
    map: map,
    center: qth,
    radius: 1000 * radius,
    clickable: false,
  });
  circles.push(c);
}