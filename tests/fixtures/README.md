`video.mp4` is a generated one-second 64×64 H.264 solid-color clip, used to test actual browser decoding and playback with mocked storage. Regenerate with:

```sh
ffmpeg -f lavfi -i color=c=0x24172f:s=64x64:r=5 -t 1 -c:v libx264 -pix_fmt yuv420p -movflags +faststart video.mp4
```
