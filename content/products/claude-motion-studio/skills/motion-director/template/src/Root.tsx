import React from "react";
import { Composition } from "remotion";
import { Captions, captionsDefaults } from "./compositions/Captions";
import { DataStory, dataStoryDefaults, dataStoryLineDefaults } from "./compositions/DataStory";
import { KineticType, kineticTypeDefaults } from "./compositions/KineticType";
import { LogoSting, logoStingDefaults } from "./compositions/LogoSting";
import { ProductPromo, productPromoDefaults } from "./compositions/ProductPromo";
import { StyleBoard, styleBoardDefaults } from "./compositions/StyleBoard";
import { STYLE_IDS } from "./styles/styles";

/**
 * Every composition in the project. Change the look of any of them by
 * passing a different `style` in props:
 *
 *   npx remotion render KineticType out/reel.mp4 --props='{"style":"swiss-grid"}'
 *   npx remotion render DataStory out/chart.mp4 --props=props/chart.json
 *
 * Sizes: 1080×1920 for Reels/TikTok/Shorts, 1920×1080 for YouTube and sites.
 * To render another size, pass --width/--height or duplicate a <Composition>.
 */
export const Root: React.FC = () => (
  <>
    <Composition id="KineticType" component={KineticType} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={kineticTypeDefaults} />
    <Composition id="DataStory" component={DataStory} durationInFrames={240} fps={30} width={1920} height={1080} defaultProps={dataStoryDefaults} />
    <Composition id="DataStoryLine" component={DataStory} durationInFrames={240} fps={30} width={1920} height={1080} defaultProps={dataStoryLineDefaults} />
    <Composition id="ProductPromo" component={ProductPromo} durationInFrames={300} fps={30} width={1920} height={1080} defaultProps={productPromoDefaults} />
    <Composition id="Captions" component={Captions} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={captionsDefaults} />
    <Composition id="LogoSting" component={LogoSting} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={logoStingDefaults} />
    <Composition id="StyleBoard" component={StyleBoard} durationInFrames={STYLE_IDS.length * 30} fps={30} width={1920} height={1080} defaultProps={styleBoardDefaults} />
  </>
);
