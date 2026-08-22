# Blog post to podcast

Point it at any blog post URL, get a podcast-style MP3 out. Pairs with the
Speechify post *"Turn this blog post into a podcast episode with the Speechify
API"*.

## What you get

A single-file Node script that turns a web page into an episode:

1. fetches the URL and pulls the readable text out of the `<article>`/`<main>` HTML,
2. chunks it on paragraph/sentence boundaries (each call stays under the API input cap),
3. synthesizes each chunk via the Speechify API,
4. stitches the parts into one MP3 with ffmpeg.

## Run it yourself

```bash
cp .env.example .env      # paste your key into .env
npm install

npm start -- https://speechify.ai/blog/some-post -v lily --model simba-english
# ...writes output/<host>-<ts>/part-000.mp3, part-001.mp3, ...

./concat.sh output/<host>-<ts> podcast-episode.mp3
```

Prerequisites: Node 20+, ffmpeg on your PATH, a Speechify API key from
[platform.speechify.ai/api-keys](https://platform.speechify.ai/api-keys).

## Notes

- The extractor is naive on purpose — it strips script/style/nav/footer blocks
  and tags from the page. JS-rendered sites will yield nothing; point it at the
  raw HTML or a static post instead.
- Long posts are chunked so every synthesis call stays under the input-size
  limit; the parts are concatenated losslessly (`-c copy`).