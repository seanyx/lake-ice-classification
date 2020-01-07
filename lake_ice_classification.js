
// EXPORT TRAINING DATASET AS AN ASSET

// asset_name
var assetName = 'Lake_ice_classification/lakeIceTrainingData';

var bands = ['Red', 'Green', 'Blue', 'Nir', 'Swir1', 'Swir2', 'Blue_diss', 'Red_diss', 'Green_diss', 'sam', 'sid', 'sed', 'emd', 'hue', 'saturation', 'value'];
var fns = require("users/eeProject/river_ice_fraction:functions_river_ice.js");

exports.merge_collections_std_bandnames_collection1tier1 = function() {
  // """merge landsat 5, 7, 8 collection 1 tier 1 imageCollections and standardize band names
  // """
  // ## standardize band names
    var bn8 = ['B2', 'B3', 'B4', 'B6', 'B7', 'BQA', 'B5'];
    var bn7 = ['B1', 'B2', 'B3', 'B5', 'B7', 'BQA', 'B4'];
    var bn5 = ['B1', 'B2', 'B3', 'B5', 'B7', 'BQA', 'B4'];
    var bns = ['Blue', 'Green', 'Red', 'Swir1', 'Swir2', 'BQA', 'Nir'];
    
    // # create a merged collection from landsat 5, 7, and 8
      var ls5 = ee.ImageCollection("LANDSAT/LT05/C01/T1_TOA").select(bn5, bns);
      
      var ls7 = (ee.ImageCollection("LANDSAT/LE07/C01/T1_RT_TOA")
                 .filterDate('1999-01-01', '2003-05-30')
                 .select(bn7, bns));
      
      var ls8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_RT_TOA").select(bn8, bns);
      
      var merged = ee.ImageCollection(ls5.merge(ls7).merge(ls8));
      
      return(merged);
};
var Mndwi = function(image) {
  return(image.normalizedDifference(['Green', 'Swir1']).rename('mndwi'));
};
var spectralDist = function(image, bandsA, bandsB, metric) {
  var dist = image.select(bandsA).spectralDistance(image.select(bandsB), metric).rename(metric);
  return(dist);
};

exports.prepPredictors = function(image) {
  
  // add texture
  image = image.addBands(image.multiply(100).int16().glcmTexture());
  
  // add spectral distance and angle
  var bandsA = ['Swir1', 'Nir'];
  var bandsB = ['Nir', 'Red'];
  image = image
  .addBands(spectralDist(image, bandsA, bandsB, 'sam'))
  .addBands(spectralDist(image, bandsA, bandsB, 'sid'))
  .addBands(spectralDist(image, bandsA, bandsB, 'sed'))
  .addBands(spectralDist(image, bandsA, bandsB, 'emd'));
  
  // add hsv
  image = image.addBands(image.select(['Red', 'Green', 'Blue']).rgbToHsv());
  
  // mask land area
  image = image.mask(Mndwi(image).gt(0));
  
  return(image);
};

var visClassSim = ee.FeatureCollection("users/eeProject/lake_ice_dataset/training_polygons_sim_ids_20190811");
// print(visClassSim.first());

var SubsampleOnePolygonTOA = function(f) {
  
  var image = ee.Image(ls.filterMetadata('LANDSAT_SCENE_ID', 'equals', f.get('LANDSAT')).first());
  
  // add predictor bands
  image = exports.prepPredictors(image);
  
  var result = image.select(bands).sample({
    region: f.geometry(), 
    numPixels: 1000, 
    scale: 30,
    seed: 2019,
    tileScale: 1,
    geometries: true
  }).map(function(g) {
    return(g.copyProperties(f, ['class', 'scl_int', 'Hylak_d']).copyProperties(image, ['LANDSAT_SCENE_ID']));
  });
  
  return(result);
};

var ls = exports.merge_collections_std_bandnames_collection1tier1();

var dat = visClassSim.map(SubsampleOnePolygonTOA).flatten();

print(dat.first());
print(visClassSim.first());
// print(dat.size());

Export.table.toAsset({
  collection: dat,
  description: 'lake_ice_training_data_TOA', 
  assetId: assetName});

// SPLIT THE TRAINING DATA INTO TRAINING, TESTING, AND VALIDATION DATASET
// 1. take data from 70% of the lakes as training + testing
// 2. sample the training dataset stratified according to the class
var inputCat = ['water', 'clear_ice', 'opaque_ice', 'snow', 'FSI_clouds', 'cloudy_water'];
var splitCat = function(inputCat, percent, seed) {
  // split the input polygons into training and validation sets, the split 
  // is denoted in the property 'split'.
  var training = [], validation = [];
  var n = inputCat.length;
  var nc, nt;
  for (var i = 0; i < n; i++) {
    
    nc = visClassSimFil.filterMetadata('class', 'equals', inputCat[i]).size().getInfo();
    nt = ee.Number(nc).multiply(percent).round();
    
    var tmp = visClassSimFil
    .filterMetadata('class', 'equals', inputCat[i])
    .randomColumn('random', seed);
    
    training.push(
      tmp.sort('random', true).limit(nt));
    validation.push(
      tmp.sort('random', false).limit(ee.Number(nc).subtract(nt)));
  }
  
  training = ee.FeatureCollection(training).flatten().map(function(f) {return(f.set('split', 'training'))});
  validation = ee.FeatureCollection(validation).flatten().map(function(f) {return(f.set('split', 'validation'))});
  
  return(ee.FeatureCollection(ee.List([training, validation])).flatten());
};

var dat = ee.FeatureCollection('users/eeProject/Lake_ice_classification/lakeIceTrainingData');
print('Total number of records: ', dat.size()); // var training = dat.aggregate_array

var lakeIds = ee.FeatureCollection(ee.List(dat.aggregate_array('Hylak_d')).distinct().map(function(l) {return(ee.Feature(null, {'Hylak_d': l}))})).randomColumn('random');
// print(lakeIds);

dat = dat.remap({
  lookupIn: ['water', 'clear_ice', 'opaque_ice', 'snow'], 
  lookupOut: [0, 1, 1, 1], 
  columnName: 'class'});

// print(dat.first());

var lakeIdsTraining = lakeIds.sort('random', true).filterMetadata('random', 'less_than', 0.7);
var lakeIdsValidation = lakeIds.sort('random', true).filterMetadata('random', 'not_less_than', 0.7);
print('Number of lakes used for training: ', lakeIdsTraining.size());
print('Number of lakes used for validation: ', lakeIdsValidation.size());

// define a simple join
var filter = ee.Filter.equals({
  leftField: 'Hylak_d',
  rightField: 'Hylak_d'
});
var trainingData = ee.Join.simple().apply(dat, lakeIdsTraining, filter);
var validationData = ee.Join.simple().apply(dat, lakeIdsValidation, filter);

print('Number of records used for training: ', trainingData.size());
print('Number of records used for validation: ', validationData.size());

// CONSTRUCT CLASSIFIERS

var rfClassifier = ee.Classifier.randomForest(5, 0, 50).train({
  features: trainingData, 
  classProperty: 'class',
  inputProperties: bands});

var cartClassifier = ee.Classifier.cart(10, 5, 25, 25).train({
  features: trainingData, 
  classProperty: 'class',
  inputProperties: bands});

var rfMatrix = rfClassifier.confusionMatrix();
var cartMatrix = cartClassifier.confusionMatrix();

print('Random Forest Kappa: ', rfMatrix.kappa());
print('CART Kappa: ', cartMatrix.kappa());

// apply the classifier on validaiton data
print('Random Forest validation kappa: ', validationData.classify(rfClassifier, 'classified').errorMatrix('class', 'classified').kappa());
print('CART validation kappa: ', validationData.classify(cartClassifier, 'classified').errorMatrix('class', 'classified').kappa());


// visualize the result
validationData.first().aside(print);
var img = ee.Image(ls.filterMetadata('LANDSAT_SCENE_ID', 'equals', ee.Feature(validationData.first()).get('LANDSAT_SCENE_ID')).first()).aside(print);
Map.centerObject(img);
Map.addLayer(img, {bands: ['Red', 'Green', 'Blue'], gamma: 1.5}, 'img');



