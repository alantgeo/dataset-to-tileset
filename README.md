# dataset-to-tileset

Command line tool to convert a [Mapbox Dataset](https://www.mapbox.com/help/studio-manual-datasets/) into a [Mapbox Tileset](https://www.mapbox.com/help/studio-manual-tilesets/) while applying a bunch of helper operations including:
* Smooth lines using a bezier spline
* Add point nodes to polygons for labels
* Add point nodes to lines for labels
* Add arrowhead points (where feature property is `_arrow = start|end|both`)

## Install

    npm install -g dataset-to-tileset

## Usage

    export MAPBOX_ACCESS_TOKEN=sk...
    dataset-to-tileset DATASET_ID [TILESET_ID]

eg. dataset-to-tileset ckj1234567890 username.abcdefg

Your Mapbox access token must have scopes `datasets:read` and 'uploads:write'.
