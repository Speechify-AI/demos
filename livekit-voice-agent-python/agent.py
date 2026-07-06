import logging

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, openai, speechify

load_dotenv()

logger = logging.getLogger("speechify-voice-agent")


async def entrypoint(ctx: JobContext) -> None:
    # AgentSession uses the bundled Silero VAD by default.
    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4.1-mini"),
        tts=speechify.TTS(voice_id="dominic_32", model="simba-3.2"),
    )

    await session.start(
        agent=Agent(
            instructions=(
                "You are a helpful voice assistant speaking with a Speechify voice. "
                "Keep replies short and conversational."
            )
        ),
        room=ctx.room,
    )

    await ctx.connect()
    await session.say("Hi! I'm powered by Speechify text to speech. How can I help?")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
