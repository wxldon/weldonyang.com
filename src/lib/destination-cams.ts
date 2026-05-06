// Curated destination webcams — National Park / shoreline cams hosted by
// nps.gov, USGS, and partner operators. No public API for these; URLs were
// each verified by hand and live behind nps.gov/{park}/learn/photosmultimedia/webcams.htm.

export interface DestinationCam {
  id: string;
  park: string;
  name: string;
  imageUrl: string;
  sourceUrl: string;
  refreshNote: string;
}

export const DESTINATION_CAMS: DestinationCam[] = [
  {
    id: "yose-half-dome",
    park: "Yosemite NP",
    name: "Half Dome / Valley View",
    imageUrl: "https://www.nps.gov/featurecontent/ard/webcams/images/yoselarge.jpg",
    sourceUrl: "https://www.nps.gov/yose/learn/photosmultimedia/webcams.htm",
    refreshNote: "every ~10 min",
  },
  {
    id: "yose-merced",
    park: "Yosemite NP",
    name: "Merced River at Happy Isles",
    imageUrl:
      "https://usgs-nims-images.s3.amazonaws.com/overlay/CA_Merced_River_at_Happy_Isles_Bridge_Yosemite/CA_Merced_River_at_Happy_Isles_Bridge_Yosemite_newest.jpg",
    sourceUrl: "https://www.nps.gov/yose/learn/photosmultimedia/webcams.htm",
    refreshNote: "USGS · every ~5 min",
  },
  {
    id: "yose-ski",
    park: "Yosemite NP",
    name: "Badger Pass Ski Area",
    imageUrl: "https://pixelcaster.com/aramark/yosemite-ski.jpg",
    sourceUrl: "https://www.nps.gov/yose/learn/photosmultimedia/webcams.htm",
    refreshNote: "every ~5 min",
  },
  {
    id: "pore-cam",
    park: "Point Reyes NS",
    name: "Lighthouse Headland",
    imageUrl: "https://www.nps.gov/featurecontent/ard/webcams/images/pore.jpg",
    sourceUrl: "https://www.nps.gov/pore/learn/photosmultimedia/webcams.htm",
    refreshNote: "every ~15 min",
  },
];
