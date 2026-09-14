import logging

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, ModelSettings, cli
from livekit.agents.voice.io import TimedString
from livekit.plugins import deepgram, openai, speechify

load_dotenv()
logger = logging.getLogger("speechify-captions")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are a helpful voice assistant speaking with a Speechify voice. "
                "Keep replies short and conversational."
            )
        )

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions="Greet the user and mention your voice is powered by Speechify."
        )

    async def transcription_node(self, text, model_settings: ModelSettings):
        # `text` streams the words the agent is about to speak. With Speechify
        # TTS, each word arrives as a TimedString carrying start/end times (in
        # seconds). Read them here, then yield the chunk on unchanged so the
        # normal transcript still forwards to the room.
        async for chunk in text:
            if (
                isinstance(chunk, TimedString)
                and isinstance(chunk.start_time, (int, float))
                and isinstance(chunk.end_time, (int, float))
            ):
                logger.info("[%6.2f-%6.2f] %s", chunk.start_time, chunk.end_time, chunk)
            yield chunk


server = AgentServer()


@server.rtc_session(agent_name="speechify-captions-demo")
async def entrypoint(ctx: JobContext) -> None:
    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4.1-mini"),
        # simba-3.2 is streaming-native, so it serves word marks.
        tts=speechify.TTS(voice_id="dominic_32", model="simba-3.2"),
    )
    await session.start(agent=Assistant(), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
