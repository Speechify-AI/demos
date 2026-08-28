# RSS to daily audio digest

Point it at any RSS feed, get a spoken daily digest. Pairs with the speechify.ai
post *"Turn an RSS feed into a daily audio digest with the Speechify API"*.

## What you get

A single-file Node script that turns a feed into one audio file:

1. fetches and parses the RSS feed,
2. builds a spoken digest from today's items (titles + article snippets),
3. chunks it so every synthesis call stays under the API input cap,
4. synthesizes each chunk via the Speechify API
   (`client.audio.speech()`),
5. stitches the parts into one MP3 with ffmpeg.

## Run it yourself

```bash
cp .env.example .env      # paste your key into .env
npm install

# today's items from any feed
npm start -- https://speechify.ai/feed.xml --today
# or the latest N items (default 5)
npm start -- https://speechify.ai/feed.xml --latest 10

# ...writes output/<host>-<ts>/part-000.mp3, part-001.mp3, ...

./concat.sh output/<host>-<ts> daily-digest.mp3
```

Prerequisites: Node 20+, ffmpeg on your PATH, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Notes

- The digest is built from each item's title plus the first two sentences of
  its content snippet — enough to skim, light on characters.
- `--today` filters to items published today (UTC), for a true daily digest;
  default is the latest 5 items.
- Long digests are chunked so every call stays under the input-size limit; the
  parts are concatenated losslessly (`-c copy`).