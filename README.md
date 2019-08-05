# Lake ice classification
Google Earth Engine interface to aid building training data for classifying ice formation on lake surfaces

## Setup the script
1. Open [this](https://code.earthengine.google.com/b7499cdc58b6d76ffb60d1a49a6bd083) GEE script in a new tab, and save the script to your own GEE repository;
2. run the script, and when the interface appears on the map, click on the "next" button to go to the first lake, or enter the lake index directly in the textbox to the right of the "next" button;
3. save frequently, and when you're done for the day, save the script first then export the data by running the script and initiate the task.

![steps to classify lake ice](lake_ice_classification.png)

## Categories:

Class name|Description
---|---
Cat1. partial_img_cover|add a polygon of this category if Landsat image does not fully cover the lake polygon
Cat2. snow|lake surface covered by snow
Cat3. opaque_ice|lake surface covered by opaque ice
Cat4. clear_ice|lake surface covered by clear ice
Cat5. water|lake water surface
Cat6. cloudy_opaque_ice|opaque ice cover on lakes seen through thin cloud cover
Cat7. cloudy_clear_ice|clear ice cover on lakes seen through thin cloud cover
Cat8. cloudy_water|lake water surface seen through thin cloud cover
Cat9. FSI_clouds|opaque or thin cloud covered lake surface where Fmask classifies as snow/ice
Cat10. uncertain|any situation where none of the above categories can be assigned over the entire lake

## Examples
