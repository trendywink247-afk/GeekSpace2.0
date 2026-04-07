# Office Lo-Fi Audio

Drop a royalty-free lo-fi loop here named **`lofi-loop.mp3`**.

## Recommended sources

- [Pixabay — Lo-Fi](https://pixabay.com/music/search/lofi/)
- [Freesound — Lo-Fi](https://freesound.org/search/?q=lofi+loop)
- [Free Music Archive](https://freemusicarchive.org/)

## Requirements

- Format: MP3 (for broadest browser support)
- Duration: 2–5 minutes (loops seamlessly)
- License: CC0 / royalty-free

## Behaviour

Audio is **muted by default**. To enable:

```js
localStorage.setItem('office_audio_enabled', 'true');
```

Then use the `initAudio()` controller from `systems/ambient/audio.ts`.
