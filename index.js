#!/usr/bin/env node

var MapboxClient = require('mapbox');
var mapbox = new MapboxClient(process.env.MAPBOX_ACCESS_TOKEN);
var argv = require('minimist')(process.argv.slice(2));
var upload = require('mapbox-upload');
var randomstring = require('randomstring');
var getUser = require('mapbox/lib/get_user');
var fs = require('fs');
var mktemp = require('mktemp');
var argv = require('minimist')(process.argv.slice(2));

const polylabel = require('polylabel');
const turf = {
    bezier: require('@turf/bezier'),
    featureEach: require('@turf/meta').featureEach,
    area: require('@turf/area'),
    point: require('@turf/helpers').point,
    bearing: require('@turf/bearing'),
    featureCollection: require('@turf/helpers').featureCollection,
    along: require('@turf/along'),
    lineDistance: require('@turf/line-distance')
};

var username = getUser(process.env.MAPBOX_ACCESS_TOKEN);

var sourceDataset = argv._[0];
var destTileset = argv._[1];

if (!sourceDataset) {
    console.log('Usage: mapbox-dataset-to-tileset [--intermediate=tileset.geojson] DATASET_ID [TILESET_ID]');
    process.exit();
}

if (!destTileset) {
    destTileset = username + '.' + randomstring.generate({
        length: 8,
        charset: 'alphanumeric',
        capitalization: 'lowercase'
    });
}

function labelPolygonFeature(feature) {
    // find pole of inaccessibility
    var labelPoint = polylabel(feature.geometry.coordinates, feature.properties.precision || 0.001);

    // calculate polygon area
    var area = turf.area(feature)

    // create a new GeoJSON feature from the pole of inaccessibility, the original properties plus an _area property
    return turf.point(
        labelPoint,
        Object.assign(
            {
                _area: area,
                _label: true
            },
            feature.properties
        )
    );
}

var featureCount = 0;
var featureCountTotal = 0;
var inputFeatures = [];
var outputFeatures = [];
var datasetName;

mapbox.readDataset(sourceDataset, function (err, dataset) {
    if (err) {
        console.error(err);
    }
    datasetName = dataset.name;
    console.log('Input Dataset "' + datasetName + '" (https://www.mapbox.com/studio/datasets/' + dataset.owner + '/' + sourceDataset + '/)');
    featureCountTotal = dataset.features;

    mapbox.listFeatures(sourceDataset, {limit: 100}, readFeatures);
});

function readFeatures(err, collection, res) {
    if (err) {
        console.error(err);
    }
    featureCount += collection.features.length;

    if (collection.features.length) {
        console.log(featureCount + ' of ' + featureCountTotal);
    }

    inputFeatures.push(...collection.features);

    if (res.nextPage) {
        res.nextPage(readFeatures);
    } else {
        processFeatures();
    }
}

function arrowHeadStart(feature) {
    return turf.point(
        feature.geometry.coordinates[0],
        Object.assign(
            {
                _arrow: 'start',
                _rotation: turf.bearing.apply(null, (feature.geometry.coordinates.slice(0, 2).map((coord) => {
                    return turf.point(coord);
                }).reverse()))
            },
            feature.properties
        )
    );
}

function arrowHeadEnd(feature) {
    return turf.point(
        feature.geometry.coordinates.slice(-1)[0],
        Object.assign(
            {
                _arrow: 'end',
                _rotation: turf.bearing.apply(null, (feature.geometry.coordinates.slice(-2).map((coord) => {
                    return turf.point(coord);
                })))
            },
            feature.properties
        )
    );
}

function arrowHead(feature) {
    var arrows = [];
    switch (feature.properties['_arrow']) {
        case 'start':
            arrows.push(arrowHeadStart(feature));
            break;
        case 'end':
            arrows.push(arrowHeadEnd(feature));
            break;
        case 'both':
            arrows.push(arrowHeadStart(feature));
            arrows.push(arrowHeadEnd(feature));
            break;
    }
    return arrows;
}

function labelLineStringFeature(line) {
    var length = turf.lineDistance(line);
    // midpoint along the line
    var point = turf.along(line, length / 2);
    point.properties = Object.assign(
            {
                _length: length,
                _label: true
            },
            line.properties
        );
    return point;
}

function processFeatures() {
    var smoothedLines = 0;
    var lineLabels = 0;
    var polygonLabels = 0;
    var arrowHeads = 0;

    inputFeatures.forEach(function (feature) {
        if (!feature.geometry) {
            outputFeatures.push(feature);
            return;
        }
        if (feature.geometry.type === 'Polygon') {
            outputFeatures.push(labelPolygonFeature(feature));
            polygonLabels++;
            outputFeatures.push(feature);
        } else if (feature.geometry.type === 'LineString') {
            var resolution = feature.properties.resolution;
            var sharpness = feature.properties.sharpness;

            var curve = turf.bezier(feature, resolution || 10000, sharpness || 0.85);
            outputFeatures.push(curve);
            smoothedLines++;

            outputFeatures.push(labelLineStringFeature(curve));
            lineLabels++;

            if ('_arrow' in feature.properties) {
                outputFeatures.push(...arrowHead(curve));
                arrowHeads++;
            }
        } else {
            outputFeatures.push(feature);
            return;
        }
    });

    console.log(polygonLabels + ' polygon labels created');
    console.log(lineLabels + ' line labels created');
    console.log(smoothedLines + ' lines smoothed');
    console.log(arrowHeads + ' arrow heads created');

    var geojson = turf.featureCollection(outputFeatures);

    var path = argv.intermediate ? argv.intermediate : mktemp.createFileSync('XXXXXXX.geojson');
    fs.writeFileSync(path, JSON.stringify(geojson));

    var uploadProgress = upload({
        file: path,
        account: username,
        accesstoken: process.env.MAPBOX_ACCESS_TOKEN,
        mapid: destTileset,
        name: datasetName
    });

    uploadProgress.on('error', function (err) {
        if (err) {
            console.error(err);
        }
        if (!argv.intermediate) {
            fs.unlinkSync(path);
        }
    });
    uploadProgress.once('finished', function () {
        if (!argv.intermediate) {
            fs.unlinkSync(path);
        }
        console.log('https://www.mapbox.com/studio/tilesets/' + destTileset + '/');
    });
}
