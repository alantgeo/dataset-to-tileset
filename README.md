# dataset-to-tileset

Command line tool to convert a Mapbox Dataset into a Mapbox Tileset while applying a bunch of helper operations including:
* Smooth lines using a bezier spline
* Add point nodes to polygons for labels
* Add point nodes to lines for labels
* Add arrowhead points (where feature property is `_arrow = start|end|both`)

## Install

   npm install -g dataset-to-tileset

## Usage

    dataset-to-tileset DATASET_ID [TILESET_ID]

    eg. dataset-to-tileset ckj1234567890 username.abcdefg


