from dotenv import load_dotenv

from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession
from livekit.plugins import deepgram, openai, speechify

load_dotenv()


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are a helpful voice assistant speaking with a Speechify voice. "
                "Keep replies short, clear, and conversational."
            )
        )


server = AgentServer()


@server.rtc_session(agent_name="speechify-tts-demo")
async def entrypoint(ctx: agents.JobContext) -> None:
    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=speechify.TTS(voice_id="dominic_32", model="simba-3.2"),
    )

    await session.start(room=ctx.room, agent=Assistant())
    await session.generate_reply(
        instructions="Greet the user and mention that your voice is powered by Speechify TTS."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
