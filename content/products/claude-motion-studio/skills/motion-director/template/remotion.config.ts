import { Config } from "@remotion/cli/config";

// H.264 in yuv420p plays everywhere: browsers, phones, Telegram, Instagram.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(18);
Config.setOverwriteOutput(true);
