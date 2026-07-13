import os

from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.anthropic.llm import AnthropicLLMService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.speechify.tts import SpeechifyTTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.transports.websocket.server import WebsocketServerParams
from pipecat.workers.runner import WorkerRunner


load_dotenv(override=True)

DEFAULT_SPEECHIFY_BASE_URL = "https://api.speechify.ai/v1"

transport_params = {
    "eval": lambda: WebsocketServerParams(audio_in_enabled=True, audio_out_enabled=True),
    "daily": lambda: DailyParams(audio_in_enabled=True, audio_out_enabled=True),
    "twilio": lambda: FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True),
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
}


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Set {name}, or copy .env.example to .env and fill it in.")
    return value


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info("Starting Pipecat bot with Speechify TTS")

    stt = DeepgramSTTService(api_key=require_env("DEEPGRAM_API_KEY"))

    tts = SpeechifyTTSService(
        api_key=require_env("SPEECHIFY_API_KEY"),
        base_url=os.environ.get("SPEECHIFY_BASE_URL", DEFAULT_SPEECHIFY_BASE_URL),
        settings=SpeechifyTTSService.Settings(
            voice=os.environ.get("SPEECHIFY_VOICE_ID", "jack"),
            model=os.environ.get("SPEECHIFY_MODEL", "simba-english"),
            loudness_normalization=True,
            text_normalization=True,
        ),
    )

    llm = AnthropicLLMService(
        api_key=require_env("ANTHROPIC_API_KEY"),
        model="claude-haiku-4-5",
        settings=AnthropicLLMService.Settings(
            system_instruction=(
                "You are a helpful assistant in a live voice conversation. "
                "Your replies are spoken aloud with Speechify TTS, so keep them brief, "
                "plain, and easy to say. Do not use emojis, bullets, or formatting."
            ),
        ),
    )

    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message(
            {
                "role": "developer",
                "content": "Introduce yourself in one sentence and ask what the user wants to build.",
            }
        )
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
