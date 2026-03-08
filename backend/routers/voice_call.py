# # """WebSocket voice call endpoint with VAD and noise filtering."""

# # from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# # from database import SessionLocal
# # from models import Agent
# # from services.gemini_service import (
# #     generate_response, get_tanglish_system_prompt,
# #     speech_to_text, text_to_speech
# # )
# # from services.embeddings import search_knowledge_base
# # from services.audio_processor import process_audio_pipeline
# # import json
# # import base64
# # import asyncio
# # import traceback

# # router = APIRouter(tags=["voice_call"])


# # @router.websocket("/ws/call/{agent_id}")
# # async def voice_call(websocket: WebSocket, agent_id: str):
# #     """WebSocket endpoint for real-time voice calls with an agent.

# #     Protocol:
# #     - Client sends: {"type": "audio", "data": "<base64 audio>"}
# #     - Client sends: {"type": "end_turn", "fullAudio": "<base64>"} when user stops speaking
# #     - Client sends: {"type": "text", "text": "..."} for text chat
# #     - Server sends: {"type": "transcript", "text": "..."} for STT result
# #     - Server sends: {"type": "response", "text": "..."} for AI response
# #     - Server sends: {"type": "audio", "data": "<base64>", "text": "..."} for TTS
# #     - Server sends: {"type": "status", "text": "..."} for status updates
# #     - Server sends: {"type": "error", "text": "..."} for errors
# #     """
# #     await websocket.accept()

# #     db = SessionLocal()
# #     try:
# #         # Validate agent
# #         agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #         if not agent:
# #             await websocket.send_json({
# #                 "type": "error",
# #                 "text": "Agent not found"
# #             })
# #             await websocket.close()
# #             return

# #         system_prompt = get_tanglish_system_prompt(
# #             agent.system_prompt or "", agent.role
# #         )

# #         conversation_history = []
# #         audio_buffer = b''

# #         await websocket.send_json({
# #             "type": "status",
# #             "text": f"Connected to {agent.name}. Start speaking or type a message..."
# #         })

# #         while True:
# #             try:
# #                 raw_data = await asyncio.wait_for(
# #                     websocket.receive_text(), timeout=300
# #                 )  # 5 min timeout
# #                 message = json.loads(raw_data)
# #                 msg_type = message.get("type", "")

# #                 if msg_type == "audio":
# #                     # Accumulate audio chunks
# #                     audio_data = message.get("data", "")
# #                     if audio_data:
# #                         audio_chunk = base64.b64decode(audio_data)
# #                         audio_buffer += audio_chunk

# #                 elif msg_type == "end_turn":
# #                     # Use fullAudio if provided (complete recording blob)
# #                     full_audio_b64 = message.get("fullAudio", "")

# #                     if not full_audio_b64 and not audio_buffer:
# #                         await websocket.send_json({
# #                             "type": "status",
# #                             "text": "No audio received. Please try again."
# #                         })
# #                         continue

# #                     await websocket.send_json({
# #                         "type": "status",
# #                         "text": "Processing your voice..."
# #                     })

# #                     try:
# #                         # Use the full audio blob for STT (better quality)
# #                         if full_audio_b64:
# #                             audio_for_stt = base64.b64decode(full_audio_b64)
# #                         else:
# #                             audio_for_stt = audio_buffer

# #                         audio_buffer = b''  # Reset buffer

# #                         if len(audio_for_stt) < 100:
# #                             await websocket.send_json({
# #                                 "type": "status",
# #                                 "text": "Audio too short. Please speak longer."
# #                             })
# #                             continue

# #                         # Speech to Text
# #                         transcript = await speech_to_text(audio_for_stt)

# #                         if not transcript:
# #                             await websocket.send_json({
# #                                 "type": "status",
# #                                 "text": "Could not understand speech. Please try again."
# #                             })
# #                             continue

# #                         await websocket.send_json({
# #                             "type": "transcript",
# #                             "text": transcript
# #                         })

# #                         # Process like a text message from here
# #                         await process_and_respond(
# #                             websocket, transcript, agent, agent_id,
# #                             system_prompt, conversation_history, db
# #                         )

# #                     except Exception as e:
# #                         print(f"❌ Voice processing error: {e}")
# #                         traceback.print_exc()
# #                         await websocket.send_json({
# #                             "type": "error",
# #                             "text": f"Voice processing error: {str(e)}"
# #                         })

# #                 elif msg_type == "text":
# #                     # Text chat fallback
# #                     user_text = message.get("text", "").strip()
# #                     if not user_text:
# #                         continue

# #                     print(f"💬 Text message received: {user_text}")

# #                     try:
# #                         await process_and_respond(
# #                             websocket, user_text, agent, agent_id,
# #                             system_prompt, conversation_history, db
# #                         )
# #                     except Exception as e:
# #                         print(f"❌ Text processing error: {e}")
# #                         traceback.print_exc()
# #                         await websocket.send_json({
# #                             "type": "error",
# #                             "text": f"Processing error: {str(e)}"
# #                         })

# #                 elif msg_type == "ping":
# #                     await websocket.send_json({"type": "pong"})

# #             except asyncio.TimeoutError:
# #                 await websocket.send_json({
# #                     "type": "status",
# #                     "text": "Call timed out due to inactivity."
# #                 })
# #                 break

# #     except WebSocketDisconnect:
# #         print(f"WebSocket disconnected for agent {agent_id}")
# #     except Exception as e:
# #         print(f"❌ WebSocket error: {e}")
# #         traceback.print_exc()
# #         try:
# #             await websocket.send_json({
# #                 "type": "error",
# #                 "text": str(e)
# #             })
# #         except:
# #             pass
# #     finally:
# #         db.close()


# # async def process_and_respond(
# #     websocket, user_text, agent, agent_id,
# #     system_prompt, conversation_history, db
# # ):
# #     """Shared logic for processing user text and generating AI response."""
# #     await websocket.send_json({
# #         "type": "status",
# #         "text": "Thinking..."
# #     })

# #     # RAG search
# #     try:
# #         results = await search_knowledge_base(
# #             user_text, agent_id, db, top_k=3
# #         )
# #         context = "\n\n".join(
# #             [r["content"] for r in results]
# #         ) if results else ""
# #     except Exception as e:
# #         print(f"RAG search error (non-fatal): {e}")
# #         context = ""
# #         results = []

# #     # Generate AI response
# #     conversation_history.append({
# #         "role": "user", "content": user_text
# #     })

# #     response_text = await generate_response(
# #         user_text, system_prompt, context,
# #         conversation_history
# #     )

# #     conversation_history.append({
# #         "role": "assistant", "content": response_text
# #     })

# #     await websocket.send_json({
# #         "type": "response",
# #         "text": response_text
# #     })

# #     # TTS (returns text for client-side synthesis)
# #     tts_audio = await text_to_speech(response_text, agent.voice_id)

# #     await websocket.send_json({
# #         "type": "audio",
# #         "data": base64.b64encode(tts_audio).decode('utf-8'),
# #         "text": response_text
# #     })


# """
# WebSocket voice call — Real-time, agent-speaks-first, VAD-driven pipeline.

# Flow:
#   1. WS connects → agent generates greeting → streams TTS to client immediately
#   2. Client sends continuous audio chunks (VAD handled client-side)
#   3. Server receives end_of_speech signal → STT → multi-agent → TTS → back to listening
#   4. Text fallback always available

# New message protocol:
#   Client → Server:
#     {"type": "audio_chunk",  "data": "<b64>"}          streaming mic chunks
#     {"type": "end_of_speech","fullAudio": "<b64>"}      VAD detected silence
#     {"type": "text",         "text": "..."}             text input
#     {"type": "interrupt"}                               user interrupts agent
#     {"type": "ping"}

#   Server → Client:
#     {"type": "agent_speaking_start"}                    agent TTS starting
#     {"type": "agent_speaking_end"}                      agent TTS done → listen
#     {"type": "transcript",  "text": "..."}              user STT result
#     {"type": "response",    "text": "...", "meta": {}}  agent text response
#     {"type": "audio",       "data": "<b64>", "text": "..."}  TTS audio
#     {"type": "agent_decision","data": {...}}            multi-agent metadata
#     {"type": "listening"}                               server ready for audio
#     {"type": "processing"}                              processing user speech
#     {"type": "escalation",  "text": "..."}
#     {"type": "error",       "text": "..."}
#     {"type": "status",      "text": "..."}
# """

# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from database import SessionLocal
# from models import Agent
# from services.gemini_service import (
#     get_tanglish_system_prompt, speech_to_text, text_to_speech, generate_response
# )
# from services.enhanced_rag import search_knowledge_base_enhanced, assemble_context
# from services.multi_agent import orchestrator
# import json
# import base64
# import asyncio
# import traceback

# router = APIRouter(tags=["voice_call"])


# async def _send(ws: WebSocket, payload: dict):
#     """Safe send wrapper."""
#     try:
#         await ws.send_json(payload)
#     except Exception:
#         pass


# async def _agent_greet_and_speak(
#     ws: WebSocket,
#     agent,
#     conversation_history: list,
# ):
#     """Generate and stream the agent's opening greeting."""
#     system_prompt = get_tanglish_system_prompt(
#         agent.system_prompt or "", agent.role
#     )

#     greeting_prompt = (
#         "Greet the user warmly in Tanglish. Introduce yourself by name and role. "
#         "Ask how you can help today. Keep it short — 2 sentences max."
#     )

#     await _send(ws, {"type": "agent_speaking_start"})
#     await _send(ws, {"type": "status", "text": f"{agent.name} is speaking..."})

#     try:
#         greeting = await generate_response(
#             user_message=greeting_prompt,
#             system_prompt=system_prompt,
#             context="",
#             conversation_history=[],
#         )
#     except Exception as e:
#         greeting = f"வணக்கம்! I'm {agent.name}. How can I help you today?"

#     conversation_history.append({"role": "assistant", "content": greeting})

#     await _send(ws, {"type": "response", "text": greeting, "meta": {"greeting": True}})

#     tts_bytes = await text_to_speech(greeting, agent.voice_id or "Puck")
#     await _send(ws, {
#         "type": "audio",
#         "data": base64.b64encode(tts_bytes).decode("utf-8"),
#         "text": greeting,
#     })

#     await _send(ws, {"type": "agent_speaking_end"})
#     await _send(ws, {"type": "listening"})


# async def _process_user_turn(
#     ws: WebSocket,
#     user_text: str,
#     agent,
#     agent_id: str,
#     conversation_history: list,
#     db,
# ):
#     """Full pipeline: RAG → multi-agent → TTS → back to listening."""

#     await _send(ws, {"type": "processing"})
#     await _send(ws, {"type": "status", "text": "Thinking..."})

#     # ── Enhanced RAG ──────────────────────────────────────────────
#     try:
#         results = await search_knowledge_base_enhanced(user_text, agent_id, db, top_k=5)
#         context = assemble_context(results)
#     except Exception as e:
#         print(f"RAG error (non-fatal): {e}")
#         results, context = [], ""

#     # ── Multi-agent orchestration ─────────────────────────────────
#     conversation_history.append({"role": "user", "content": user_text})

#     try:
#         decision = await orchestrator.run(
#             user_message=user_text,
#             rag_context=context,
#             agent_system_prompt=agent.system_prompt or "",
#             agent_role=agent.role,
#             conversation_history=conversation_history,
#         )
#     except Exception as e:
#         traceback.print_exc()
#         decision = None

#     if decision:
#         response_text = decision.final_response
#         conversation_history.append({"role": "assistant", "content": response_text})

#         # Send decision metadata
#         await _send(ws, {
#             "type": "agent_decision",
#             "data": {
#                 "intent": decision.intent,
#                 "sentiment": decision.sentiment,
#                 "language_hint": decision.language_hint,
#                 "should_escalate": decision.should_escalate,
#                 "rag_used": decision.rag_used,
#                 "agents_invoked": decision.agents_invoked,
#                 "confidence": decision.confidence,
#             },
#         })

#         if decision.should_escalate:
#             await _send(ws, {"type": "escalation", "text": "⚠️ Connecting you to a human agent..."})
#     else:
#         response_text = "மன்னிக்கவும், can you repeat that please?"
#         conversation_history.append({"role": "assistant", "content": response_text})

#     # ── Stream response text ──────────────────────────────────────
#     await _send(ws, {"type": "agent_speaking_start"})
#     await _send(ws, {
#         "type": "response",
#         "text": response_text,
#         "meta": {"intent": getattr(decision, "intent", ""), "sentiment": getattr(decision, "sentiment", "")},
#     })

#     # ── TTS ───────────────────────────────────────────────────────
#     tts_bytes = await text_to_speech(response_text, agent.voice_id or "Puck")
#     await _send(ws, {
#         "type": "audio",
#         "data": base64.b64encode(tts_bytes).decode("utf-8"),
#         "text": response_text,
#     })

#     await _send(ws, {"type": "agent_speaking_end"})
#     await _send(ws, {"type": "listening"})
#     await _send(ws, {"type": "status", "text": "Listening... speak now"})


# @router.websocket("/ws/call/{agent_id}")
# async def voice_call(websocket: WebSocket, agent_id: str):
#     await websocket.accept()
#     db = SessionLocal()

#     try:
#         agent = db.query(Agent).filter(Agent.id == agent_id).first()
#         if not agent:
#             await _send(websocket, {"type": "error", "text": "Agent not found"})
#             await websocket.close()
#             return

#         conversation_history: list[dict] = []
#         audio_buffer = b""
#         agent_is_speaking = False   # track whether agent TTS is in progress

#         # ── Step 1: Agent speaks first ────────────────────────────
#         await _agent_greet_and_speak(websocket, agent, conversation_history)

#         # ── Step 2: Main loop ─────────────────────────────────────
#         while True:
#             try:
#                 raw = await asyncio.wait_for(
#                     websocket.receive_text(), timeout=300
#                 )
#                 msg = json.loads(raw)
#                 msg_type = msg.get("type", "")

#                 if msg_type == "audio_chunk":
#                     # Accumulate mic chunks (VAD handled on client)
#                     data = msg.get("data", "")
#                     if data:
#                         audio_buffer += base64.b64decode(data)

#                 elif msg_type == "end_of_speech":
#                     # VAD detected end of user speech → process immediately
#                     full_b64 = msg.get("fullAudio", "")
#                     audio_for_stt = base64.b64decode(full_b64) if full_b64 else audio_buffer
#                     audio_buffer = b""

#                     if len(audio_for_stt) < 500:
#                         await _send(websocket, {"type": "listening"})
#                         await _send(websocket, {"type": "status", "text": "Didn't catch that. Please speak again."})
#                         continue

#                     await _send(websocket, {"type": "status", "text": "Processing speech..."})

#                     transcript = await speech_to_text(audio_for_stt)

#                     if not transcript or len(transcript.strip()) < 2:
#                         await _send(websocket, {"type": "listening"})
#                         await _send(websocket, {"type": "status", "text": "Didn't catch that. Please try again."})
#                         continue

#                     await _send(websocket, {"type": "transcript", "text": transcript})
#                     await _process_user_turn(
#                         websocket, transcript, agent, agent_id,
#                         conversation_history, db
#                     )

#                 elif msg_type == "text":
#                     user_text = msg.get("text", "").strip()
#                     if not user_text:
#                         continue
#                     await _send(websocket, {"type": "transcript", "text": user_text})
#                     await _process_user_turn(
#                         websocket, user_text, agent, agent_id,
#                         conversation_history, db
#                     )

#                 elif msg_type == "interrupt":
#                     # User interrupted agent — stop speaking, start listening
#                     await _send(websocket, {"type": "agent_speaking_end"})
#                     await _send(websocket, {"type": "listening"})
#                     await _send(websocket, {"type": "status", "text": "Go ahead, I'm listening..."})

#                 elif msg_type == "ping":
#                     await _send(websocket, {"type": "pong"})

#             except asyncio.TimeoutError:
#                 await _send(websocket, {"type": "status", "text": "Call timed out due to inactivity."})
#                 break

#     except WebSocketDisconnect:
#         print(f"WebSocket disconnected for agent {agent_id}")
#     except Exception as e:
#         traceback.print_exc()
#         await _send(websocket, {"type": "error", "text": str(e)})
#     finally:
#         db.close()



"""
WebSocket voice call — Real-time, agent-speaks-first, VAD-driven pipeline.

Flow:
  1. WS connects → agent generates greeting → streams TTS to client immediately
  2. Client sends continuous audio chunks (VAD handled client-side)
  3. Server receives end_of_speech signal → STT → multi-agent → TTS → back to listening
  4. Text fallback always available

New message protocol:
  Client → Server:
    {"type": "audio_chunk",  "data": "<b64>"}          streaming mic chunks
    {"type": "end_of_speech","fullAudio": "<b64>"}      VAD detected silence
    {"type": "text",         "text": "..."}             text input
    {"type": "interrupt"}                               user interrupts agent
    {"type": "ping"}

  Server → Client:
    {"type": "agent_speaking_start"}                    agent TTS starting
    {"type": "agent_speaking_end"}                      agent TTS done → listen
    {"type": "transcript",  "text": "..."}              user STT result
    {"type": "response",    "text": "...", "meta": {}}  agent text response
    {"type": "audio",       "data": "<b64>", "text": "..."}  TTS audio
    {"type": "agent_decision","data": {...}}            multi-agent metadata
    {"type": "listening"}                               server ready for audio
    {"type": "processing"}                              processing user speech
    {"type": "escalation",  "text": "..."}
    {"type": "error",       "text": "..."}
    {"type": "status",      "text": "..."}
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from database import SessionLocal
from models import Agent, Company
from services.auth_service import SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
from services.gemini_service import (
    get_tanglish_system_prompt, speech_to_text, text_to_speech, generate_response
)
from services.enhanced_rag import search_knowledge_base_enhanced, assemble_context
from services.multi_agent import orchestrator
import json
import base64
import asyncio
import traceback

router = APIRouter(tags=["voice_call"])


async def _send(ws: WebSocket, payload: dict):
    """Safe send wrapper."""
    try:
        await ws.send_json(payload)
    except Exception:
        pass


async def _agent_greet_and_speak(
    ws: WebSocket,
    agent,
    conversation_history: list,
):
    """Generate and stream the agent's opening greeting."""
    system_prompt = get_tanglish_system_prompt(
        agent.system_prompt or "", agent.role
    )

    greeting_prompt = (
        "Greet the user warmly in Tanglish. Introduce yourself by name and role. "
        "Ask how you can help today. Keep it short — 2 sentences max."
    )

    await _send(ws, {"type": "agent_speaking_start"})
    await _send(ws, {"type": "status", "text": f"{agent.name} is speaking..."})

    try:
        greeting = await generate_response(
            user_message=greeting_prompt,
            system_prompt=system_prompt,
            context="",
            conversation_history=[],
        )
    except Exception as e:
        greeting = f"வணக்கம்! I'm {agent.name}. How can I help you today?"

    conversation_history.append({"role": "assistant", "content": greeting})

    await _send(ws, {"type": "response", "text": greeting, "meta": {"greeting": True}})

    tts_bytes = await text_to_speech(greeting, agent.voice_id or "Puck")
    await _send(ws, {
        "type": "audio",
        "data": base64.b64encode(tts_bytes).decode("utf-8"),
        "text": greeting,
    })

    await _send(ws, {"type": "agent_speaking_end"})
    await _send(ws, {"type": "listening"})


async def _process_user_turn(
    ws: WebSocket,
    user_text: str,
    agent,
    agent_id: str,
    conversation_history: list,
    db,
):
    """Full pipeline: RAG → multi-agent → TTS → back to listening."""

    await _send(ws, {"type": "processing"})
    await _send(ws, {"type": "status", "text": "Thinking..."})

    # ── Enhanced RAG ──────────────────────────────────────────────
    try:
        results = await search_knowledge_base_enhanced(user_text, agent_id, db, top_k=5)
        context = assemble_context(results)
    except Exception as e:
        print(f"RAG error (non-fatal): {e}")
        results, context = [], ""

    # ── Multi-agent orchestration ─────────────────────────────────
    conversation_history.append({"role": "user", "content": user_text})

    try:
        decision = await orchestrator.run(
            user_message=user_text,
            rag_context=context,
            agent_system_prompt=agent.system_prompt or "",
            agent_role=agent.role,
            conversation_history=conversation_history,
        )
    except Exception as e:
        traceback.print_exc()
        decision = None

    if decision:
        response_text = decision.final_response
        conversation_history.append({"role": "assistant", "content": response_text})

        # Send decision metadata
        await _send(ws, {
            "type": "agent_decision",
            "data": {
                "intent": decision.intent,
                "sentiment": decision.sentiment,
                "language_hint": decision.language_hint,
                "should_escalate": decision.should_escalate,
                "rag_used": decision.rag_used,
                "agents_invoked": decision.agents_invoked,
                "confidence": decision.confidence,
            },
        })

        if decision.should_escalate:
            await _send(ws, {"type": "escalation", "text": "⚠️ Connecting you to a human agent..."})
    else:
        response_text = "மன்னிக்கவும், can you repeat that please?"
        conversation_history.append({"role": "assistant", "content": response_text})

    # ── Stream response text ──────────────────────────────────────
    await _send(ws, {"type": "agent_speaking_start"})
    await _send(ws, {
        "type": "response",
        "text": response_text,
        "meta": {"intent": getattr(decision, "intent", ""), "sentiment": getattr(decision, "sentiment", "")},
    })

    # ── TTS ───────────────────────────────────────────────────────
    tts_bytes = await text_to_speech(response_text, agent.voice_id or "Puck")
    await _send(ws, {
        "type": "audio",
        "data": base64.b64encode(tts_bytes).decode("utf-8"),
        "text": response_text,
    })

    await _send(ws, {"type": "agent_speaking_end"})
    await _send(ws, {"type": "listening"})
    await _send(ws, {"type": "status", "text": "Listening... speak now"})


@router.websocket("/ws/call/{agent_id}")
async def voice_call(websocket: WebSocket, agent_id: str, token: str = Query(default="")):
    await websocket.accept()
    db = SessionLocal()

    try:
        # ── Auth: validate Bearer token passed as query param ──────
        company_id = None
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                if payload.get("type") == "access":
                    company_id = payload.get("sub")
            except JWTError:
                pass

        if not company_id:
            await _send(websocket, {"type": "error", "text": "Unauthorized"})
            await websocket.close(code=4001)
            return

        agent = db.query(Agent).filter(
            Agent.id == agent_id,
            Agent.company_id == company_id
        ).first()
        if not agent:
            await _send(websocket, {"type": "error", "text": "Agent not found"})
            await websocket.close()
            return

        conversation_history: list[dict] = []
        audio_buffer = b""
        agent_is_speaking = False   # track whether agent TTS is in progress

        # ── Step 1: Agent speaks first ────────────────────────────
        await _agent_greet_and_speak(websocket, agent, conversation_history)

        # ── Step 2: Main loop ─────────────────────────────────────
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=300
                )
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "audio_chunk":
                    # Accumulate mic chunks (VAD handled on client)
                    data = msg.get("data", "")
                    if data:
                        audio_buffer += base64.b64decode(data)

                elif msg_type == "end_of_speech":
                    # VAD detected end of user speech → process immediately
                    full_b64 = msg.get("fullAudio", "")
                    audio_for_stt = base64.b64decode(full_b64) if full_b64 else audio_buffer
                    audio_buffer = b""

                    if len(audio_for_stt) < 500:
                        await _send(websocket, {"type": "listening"})
                        await _send(websocket, {"type": "status", "text": "Didn't catch that. Please speak again."})
                        continue

                    await _send(websocket, {"type": "status", "text": "Processing speech..."})

                    transcript = await speech_to_text(audio_for_stt)

                    if not transcript or len(transcript.strip()) < 2:
                        await _send(websocket, {"type": "listening"})
                        await _send(websocket, {"type": "status", "text": "Didn't catch that. Please try again."})
                        continue

                    await _send(websocket, {"type": "transcript", "text": transcript})
                    await _process_user_turn(
                        websocket, transcript, agent, agent_id,
                        conversation_history, db
                    )

                elif msg_type == "text":
                    user_text = msg.get("text", "").strip()
                    if not user_text:
                        continue
                    await _send(websocket, {"type": "transcript", "text": user_text})
                    await _process_user_turn(
                        websocket, user_text, agent, agent_id,
                        conversation_history, db
                    )

                elif msg_type == "interrupt":
                    # User interrupted agent — stop speaking, start listening
                    await _send(websocket, {"type": "agent_speaking_end"})
                    await _send(websocket, {"type": "listening"})
                    await _send(websocket, {"type": "status", "text": "Go ahead, I'm listening..."})

                elif msg_type == "ping":
                    await _send(websocket, {"type": "pong"})

            except asyncio.TimeoutError:
                await _send(websocket, {"type": "status", "text": "Call timed out due to inactivity."})
                break

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for agent {agent_id}")
    except Exception as e:
        traceback.print_exc()
        await _send(websocket, {"type": "error", "text": str(e)})
    finally:
        db.close()
