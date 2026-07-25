#!/usr/bin/env python3
"""Voice bot wiring Speechify TTS into a GetStream Vision Agents pipeline.

Deepgram handles STT, Gemini handles the LLM turn, and Speechify handles TTS
via the official `vision_agents.plugins.speechify.TTS` class. The
Speechify-specific part is one constructor call:

    tts=speechify.TTS(voice_id="geffen_32", model="simba-3.2")

Usage::
    python agent.py run
"""

import asyncio
import logging

from dotenv import load_dotenv
from vision_agents.core import Runner
from vision_agents.core.agents import Agent, AgentLauncher
from vision_agents.core.edge.types import User
from vision_agents.plugins import deepgram, gemini, getstream, speechify

logger = logging.getLogger(__name__)

load_dotenv()


async def create_agent(**kwargs) -> Agent:
    """Create an agent with Deepgram STT, a Gemini LLM, and Speechify TTS."""
    agent = Agent(
        edge=getstream.Edge(),
        agent_user=User(name="Speechify Voice Bot", id="agent"),
        instructions=(
            "You are a helpful voice assistant speaking with a Speechify voice. "
            "Keep replies short, clear, and conversational."
        ),
        stt=deepgram.STT(),
        llm=gemini.LLM(),
        tts=speechify.TTS(voice_id="geffen_32", model="simba-3.2"),
    )

    return agent


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    call = await agent.create_call(call_type, call_id)

    logger.info("Starting Speechify TTS voice bot")

    async with agent.join(call):
        logger.info("Joined call")
        await asyncio.sleep(3)
        await agent.simple_response(
            "Hello! I'm listening. What would you like to talk about?"
        )
        await agent.finish()


if __name__ == "__main__":
    Runner(AgentLauncher(create_agent=create_agent, join_call=join_call)).cli()
