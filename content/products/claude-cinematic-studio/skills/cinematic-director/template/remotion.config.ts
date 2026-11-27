import { Config } from "@remotion/cli/config";

// WebGL in headless Chrome: ANGLE uses the real GPU on macOS and Windows.
// On a Linux server without a GPU, switch to "swangle" (slower, software).
Config.setChromiumOpenGlRenderer("angle");
// PNG frames keep bloom and dark gradients clean before the final encode.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// 3D frames are heavy: fewer parallel tabs render faster than many fighting for the GPU.
Config.setConcurrency(2);
