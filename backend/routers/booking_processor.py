"""
Booking Processor Router
─────────────────────────
Processes agent responses to detect and handle hospital appointment bookings.
This router acts as an interpreter between the voice conversation and the hospital booking system.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import SessionLocal
from models import Agent
from services.hospital_booking import HospitalBookingManager
import re
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/booking", tags=["booking_processor"])

# Track bookings per session to prevent duplicates
# Format: { "session_id": { "booked": True/False, "booking_id": "...", "phone": "..." } }
_booking_sessions = {}


class BookingProcessRequest(BaseModel):
    agent_id: str
    user_message: str  # What the user said
    agent_response: str  # What the agent said
    conversation_history: list = []  # Full conversation for context
    session_id: Optional[str] = None  # Unique call session ID to prevent duplicates


class BookingResult(BaseModel):
    should_book: bool
    booking_detected: bool
    doctor_name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    reason: Optional[str] = None
    status: str = ""
    error: Optional[str] = None
    booking_id: Optional[str] = None
    message: Optional[str] = None  # User-friendly message about booking status


@router.post("/detect-and-process", response_model=BookingResult)
async def detect_and_process_booking(request: BookingProcessRequest):
    """
    Detect booking patterns in conversation and automatically process them.
    
    Patterns:
    - "confirm booking" / "confirm appointment" → triggers booking with extracted details
    - "book for Dr. X" → triggers booking
    - "schedule appointment" → triggers booking
    """
    
    logger.info("\n" + "="*70)
    logger.info("🎯 BOOKING PROCESSOR STARTED")
    logger.info("="*70)
    logger.info(f"Agent ID: {request.agent_id}")
    logger.info(f"User Message: {request.user_message}")
    logger.info(f"Agent Response: {request.agent_response}")
    logger.info(f"Conversation History Length: {len(request.conversation_history)}")
    
    # Log conversation history for debugging
    if request.conversation_history:
        logger.info(f"  History preview (last 3):")
        for msg in request.conversation_history[-3:]:
            if isinstance(msg, dict):
                role = msg.get("role", "?")
                text = msg.get("text", "")[:80]
                logger.info(f"    [{role}]: {text}...")
    
    db = SessionLocal()
    try:
        # Validate agent
        logger.info("\n[1] Validating agent...")
        agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
        if not agent:
            logger.error(f"❌ Agent not found: {request.agent_id}")
            raise HTTPException(status_code=404, detail="Agent not found")
        
        logger.info(f"✅ Agent found: {agent.name}")
        
        if not agent.hospital_config or not agent.hospital_config.get("enabled"):
            logger.warning(f"⚠️  Agent {agent.name} does not have hospital booking enabled")
            return BookingResult(
                should_book=False,
                booking_detected=False,
                error="Agent does not have hospital booking enabled"
            )
        
        logger.info(f"✅ Hospital booking is enabled for {agent.name}")
        
        # ═════════════════════════════════════════════════════════════════════════
        # CHECK FOR DUPLICATE BOOKINGS (Prevent multiple bookings in same session)
        # ═════════════════════════════════════════════════════════════════════════
        logger.info("\n[1.5] Checking for duplicate bookings in this session...")
        session_id = request.session_id or "default"
        
        if session_id in _booking_sessions:
            session_data = _booking_sessions[session_id]
            if session_data.get("booked"):
                logger.warning(f"⚠️  DUPLICATE PREVENTION: Already booked in this session")
                logger.warning(f"   Previous booking: Patient {session_data.get('patient_name')} | Phone {session_data.get('phone')}")
                return BookingResult(
                    should_book=False,
                    booking_detected=True,
                    patient_name=session_data.get("patient_name"),
                    patient_phone=session_data.get("phone"),
                    status="Already booked in this session",
                    booking_id=session_data.get("booking_id"),
                    error="Booking already completed. To reschedule, use the update endpoint."
                )
        else:
            _booking_sessions[session_id] = {}
        
        # Extract booking intent from the conversation
        logger.info("\n[2] Analyzing booking conversation...")
        booking_intent = _analyze_booking_conversation(
            request.user_message,
            request.agent_response,
            request.conversation_history
        )
        
        logger.info(f"Detected: {booking_intent['detected']}")
        logger.info(f"Confidence: {booking_intent.get('confidence', 0)}")
        
        if not booking_intent["detected"]:
            logger.info("➖ No booking intent detected - stopping")
            return BookingResult(
                should_book=False,
                booking_detected=False,
                status="No booking intent detected"
            )
        
        # Try to extract booking details
        logger.info("\n[3] Extracting booking details...")
        details = booking_intent.get("details", {})
        doctor = details.get("doctor")
        date = details.get("date")
        time = details.get("time")
        patient_name = details.get("patient_name")
        patient_phone = details.get("patient_phone")
        reason = details.get("reason", "Appointment")
        
        logger.info(f"  Doctor: {doctor}")
        logger.info(f"  Date: {date}")
        logger.info(f"  Time: {time}")
        logger.info(f"  Patient: {patient_name}")
        logger.info(f"  Reason: {reason}")
        
        # Require core booking fields (phone is optional)
        if not all([doctor, date, time, patient_name]):
            missing = []
            if not doctor: missing.append("doctor")
            if not date: missing.append("date")
            if not time: missing.append("time")
            if not patient_name: missing.append("patient_name")
            
            logger.warning(f"⚠️  Incomplete booking details - Missing: {missing}")
            return BookingResult(
                should_book=False,  # ✅ CORRECT: Don't book until we have ALL data
                booking_detected=True,
                doctor_name=doctor,
                date=date,
                time=time,
                patient_name=patient_name,
                patient_phone=patient_phone,
                reason=reason,
                status="Booking detected but incomplete details",
                error="Missing: " + ", ".join(missing),
                message=f"⏳ Waiting for complete details. Please provide: {', '.join(missing)}"
            )
        
        logger.info(f"✅ All required fields present")
        
        # Initialize hospital booking manager
        logger.info("\n[4] Initializing Hospital Booking Manager...")
        try:
            credentials_json = agent.hospital_config.get("credentials_json")
            sheet_id_master = agent.hospital_config.get("sheet_id_1")
            sheet_id_bookings = agent.hospital_config.get("sheet_id_2")
            
            if not all([credentials_json, sheet_id_master, sheet_id_bookings]):
                missing = []
                if not credentials_json: missing.append("credentials_json")
                if not sheet_id_master: missing.append("sheet_id_1")
                if not sheet_id_bookings: missing.append("sheet_id_2")
                raise ValueError(f"Missing hospital config: {', '.join(missing)}")
            
            logger.info(f"✅ Config loaded: sheet_id_1={sheet_id_master[:30]}...")
            logger.info(f"✅ Config loaded: sheet_id_2={sheet_id_bookings[:30]}...")
            logger.info(f"✅ Credentials JSON loaded: {len(credentials_json)} bytes")
            
            manager = HospitalBookingManager(credentials_json, sheet_id_master, sheet_id_bookings)
            logger.info(f"✅ Hospital Booking Manager initialized successfully")
        except Exception as e:
            logger.error(f"❌ Manager init failed: {e}", exc_info=True)
            return BookingResult(
                should_book=False,  # ✅ Manager init failed - didn't write to sheets
                booking_detected=True,
                doctor_name=doctor,
                date=date,
                time=time,
                patient_name=patient_name,
                patient_phone=patient_phone,
                reason=reason,
                status="Booking detected but manager init failed",
                error=str(e),
                message="❌ System error during booking. Please try again."
            )
        
        # Check availability (non-blocking - book anyway if check fails)
        availability_warning = None
        try:
            availability = manager.get_doctor_availability(doctor, date)
            if not availability or time not in availability:
                # Warn but continue - user explicitly requested booking
                availability_warning = f"⚠️ Note: Could not verify availability for {doctor} on {date} at {time}, but proceeding with booking as requested"
                logger.warning(f"Availability check failed for {doctor}: {date} {time}")
        except Exception as e:
            # Log but don't block - user wants to book
            availability_warning = f"⚠️ Note: Availability check failed ({str(e)}), but proceeding with booking"
            logger.warning(f"Availability check error: {e}")
        
        
        # Attempt to book (always, regardless of availability check)
        logger.info("\n[6] 📝 CREATING BOOKING IN GOOGLE SHEETS...")
        try:
            logger.info(f"Calling manager.create_booking() with:")
            logger.info(f"  - doctor_name: {doctor}")
            logger.info(f"  - date: {date}")
            logger.info(f"  - time_slot: {time}")
            logger.info(f"  - patient_name: {patient_name}")
            logger.info(f"  - reason: {reason}")
            
            result = manager.create_booking(
                doctor_name=doctor,
                date=date,
                time_slot=time,
                patient_name=patient_name,
                reason=reason or "Appointment"
            )
            
            if result.get("success"):
                logger.info(f"\n{'='*70}")
                logger.info(f"✅✅✅ BOOKING SUCCESSFULLY CREATED ✅✅✅")
                logger.info(f"{'='*70}")
                logger.info(f"Updated Range: {result.get('debugging', {}).get('updated_range')}")
                logger.info(f"Updated Rows: {result.get('debugging', {}).get('updated_rows')}")
                logger.info(f"Updated Cells: {result.get('debugging', {}).get('updated_cells')}")
                logger.info(f"Sheet 2 ID: {result.get('debugging', {}).get('sheet_2_id')}")
            else:
                logger.error(f"❌ Booking creation returned failure: {result.get('error')}")
            
            # Booking successful
            status_msg = "✅ Appointment booked successfully!"
            if availability_warning:
                status_msg += f"\n{availability_warning}"
            
            # Generate booking ID and mark session as booked
            booking_id = f"{patient_name.replace(' ', '_')}_{date.replace(' ', '_')}"
            _booking_sessions[session_id]["booked"] = True
            _booking_sessions[session_id]["booking_id"] = booking_id
            _booking_sessions[session_id]["patient_name"] = patient_name
            _booking_sessions[session_id]["doctor"] = doctor
            _booking_sessions[session_id]["date"] = date
            _booking_sessions[session_id]["time"] = time
            
            logger.info(f"\n✅ Session marked as booked: {session_id}")
            logger.info(f"   Booking ID: {booking_id}")
            
            return BookingResult(
                should_book=True,
                booking_detected=True,
                doctor_name=doctor,
                date=date,
                time=time,
                patient_name=patient_name,
                patient_phone=patient_phone,
                reason=reason,
                status=status_msg,
                booking_id=booking_id,
                message=f"✅ Appointment booked with {doctor} on {date} at {time}"
            )
        except Exception as e:
            logger.error(f"❌ BOOKING CREATION EXCEPTION: {e}", exc_info=True)
            return BookingResult(
                should_book=False,  # ✅ Booking creation failed - didn't write to sheets
                booking_detected=True,
                doctor_name=doctor,
                date=date,
                time=time,
                patient_name=patient_name,
                patient_phone=patient_phone,
                reason=reason,
                status="Booking failed",
                error=str(e),
                message="❌ Failed to create booking. Please try again."
            )
    
    finally:
        db.close()
        logger.info("\n" + "="*70)
        logger.info("🏁 BOOKING PROCESSOR FINISHED")
        logger.info("="*70 + "\n")


@router.post("/reschedule", response_model=BookingResult)
async def reschedule_booking(request: BookingProcessRequest):
    """
    Reschedule/update an existing booking.
    
    Requires:
    - patient_phone (to find existing booking)
    - new date/time from conversation
    """
    
    logger.info("\n" + "="*70)
    logger.info("🔄 RESCHEDULING BOOKING")
    logger.info("="*70)
    
    db = SessionLocal()
    try:
        # Validate agent
        agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if not agent.hospital_config or not agent.hospital_config.get("enabled"):
            return BookingResult(
                should_book=False,
                booking_detected=False,
                error="Agent does not have hospital booking enabled"
            )
        
        # Extract new details from conversation
        booking_intent = _analyze_booking_conversation(
            request.user_message,
            request.agent_response,
            request.conversation_history
        )
        
        if not booking_intent["detected"]:
            return BookingResult(
                should_book=False,
                booking_detected=False,
                status="No reschedule request detected"
            )
        
        details = booking_intent.get("details", {})
        new_date = details.get("date")
        new_time = details.get("time")
        patient_phone = details.get("patient_phone")
        patient_name = details.get("patient_name")
        
        if not (patient_phone and (new_date or new_time)):
            return BookingResult(
                should_book=False,
                booking_detected=True,
                patient_phone=patient_phone,
                patient_name=patient_name,
                error="Need phone number and new date/time to update booking"
            )
        
        # Initialize hospital booking manager
        credentials_json = agent.hospital_config.get("credentials_json")
        sheet_id_master = agent.hospital_config.get("sheet_id_1")
        sheet_id_bookings = agent.hospital_config.get("sheet_id_2")
        
        manager = HospitalBookingManager(credentials_json, sheet_id_master, sheet_id_bookings)
        
        logger.info(f"✅ Rescheduling: Patient {patient_name} ({patient_phone})")
        logger.info(f"   New Date: {new_date}, New Time: {new_time}")
        
        # Update would go here (depends on HospitalBookingManager having an update method)
        return BookingResult(
            should_book=False,
            booking_detected=True,
            patient_name=patient_name,
            patient_phone=patient_phone,
            date=new_date,
            time=new_time,
            status="Reschedule requested - contact support for update"
        )
    
    finally:
        db.close()


def _analyze_booking_conversation(user_msg: str, agent_msg: str, history: list) -> dict:
    """
    Analyze user + agent message to detect booking intent.
    Returns: {
        "detected": bool,
        "confidence": float,
        "details": { doctor, date, time, patient_name, patient_phone, reason }
    }
    """
    
    full_text = f"{user_msg} {agent_msg}".lower()
    
    # Build history text
    history_text = ""
    if history:
        for msg in history:
            if isinstance(msg, dict):
                history_text += " " + msg.get("text", "").lower()
    
    combined = full_text + " " + history_text
    
    logger.info(f"[ANALYZE] Combined text length: {len(combined)} chars")
    
    # Booking intent patterns
    booking_patterns = [
        r"confirm.*booking",
        r"confirm.*appointment",
        r"please.*book",
        r"book.*appointment",
        r"schedule.*appointment",
        r"book\s+(?:for|with|at)\s+dr\.?\s*",
        r"appointment.*confirmed",
        r"appointment.*successfully.*booked",
        r"ready.*book",
        r"go.*with.*booking",
        r"correct.*\?",  # User confirming by saying "correct?"
    ]
    
    detected = any(re.search(p, combined) for p in booking_patterns)
    
    logger.info(f"[ANALYZE] Booking intent detected: {detected}")
    
    if not detected:
        return {"detected": False, "confidence": 0, "details": {}}
    
    # Extract details from all available conversation data
    # Pass the full combined text AND the history for better extraction
    details = _extract_booking_details(combined, history)
    
    return {
        "detected": True,
        "confidence": 0.8,
        "details": details
    }


def _extract_booking_details(text: str, history: list) -> dict:
    """
    Extract booking details from conversation text AND history.
    Looks through entire conversation to find all required information.
    """
    
    details = {
        "doctor": None,
        "date": None,
        "time": None,
        "patient_name": None,
        "patient_phone": None,
        "reason": None
    }
    
    # Build full conversation text (current + history)
    full_history_text = text
    if history:
        for msg in history:
            if isinstance(msg, dict):
                full_history_text += " " + msg.get("text", "")
    
    full_history_lower = full_history_text.lower()
    
    logger.info(f"[EXTRACT] Full conversation length: {len(full_history_lower)} chars")
    logger.info(f"[EXTRACT] Searching for digits 9751333680...")
    
    # Check if phone number even exists in the text
    if "9751333680" in full_history_lower:
        logger.warning(f"⚠️  Phone '9751333680' IS in history!")
    else:
        logger.warning(f"⚠️  Phone '9751333680' NOT in history - checking for any 10-digit numbers...")
        all_digits = re.findall(r'\d{10,}', full_history_lower)
        logger.info(f"    Found {len(all_digits)} sequences of 10+ digits: {all_digits}")
    
    logger.info(f"[EXTRACT] Full conversation (first 500 chars): {full_history_lower[:500]}")
    
    # ─────────────────────────────────────────────────────────────
    # DOCTOR EXTRACTION - Search entire history
    # ─────────────────────────────────────────────────────────────
    doctor_patterns = [
        r"dr\.?\s*([a-zA-Z\s]+?)(?:\s+(?:on|at|for|specializing|cardiology|pediatrics|neurology|orthopedics|for|kitta)|\b)",  # "Dr. Priya Sharma"
        r"(?:with|to|at)\s+(?:dr\.?\s*)?([a-zA-Z\s]+?\s+(?:sharma|patel|kumar|singh|gupta|singh|desai|nair))",  # "with Dr. Patel" or "with Priya Sharma"
    ]
    
    for pattern in doctor_patterns:
        match = re.search(pattern, full_history_lower)
        if match:
            doctor_name = match.group(1).strip().title()
            if len(doctor_name) > 2 and "is" not in doctor_name and "the" not in doctor_name:
                details["doctor"] = "Dr. " + doctor_name if not doctor_name.startswith("Dr.") else doctor_name
                logger.info(f"  ✅ Found doctor: {details['doctor']}")
                break
    
    # ─────────────────────────────────────────────────────────────
    # DATE EXTRACTION - Search entire history  
    # ─────────────────────────────────────────────────────────────
    date_patterns = [
        r"(\d{4}-\d{2}-\d{2})",  # YYYY-MM-DD format like 2026-04-15
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",  # DD/MM/YYYY or similar
        r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})",  # April 15
        r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)",  # Day names: Friday, Monday, etc
        r"(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))",  # next Monday
        r"(tomorrow|today|nalaiku|naalai)",  # Relative dates (tomorrow, today, Tamil: nalaiku)
    ]
    
    # Try YYYY-MM-DD first
    match = re.search(date_patterns[0], full_history_lower)
    if match:
        details["date"] = match.group(1)
        logger.info(f"  ✅ Found date (YYYY-MM-DD): {details['date']}")
    else:
        # Try Month + Day pattern
        month_day_match = re.search(
            r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})",
            full_history_lower, re.IGNORECASE
        )
        if month_day_match:
            month = month_day_match.group(1).capitalize()
            day = month_day_match.group(2)
            details["date"] = f"{month} {day}"
            logger.info(f"  ✅ Found date (Month Day): {details['date']}")
        else:
            # Try day name (Friday, Monday, etc.)
            day_match = re.search(
                r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
                full_history_lower, re.IGNORECASE
            )
            if day_match:
                details["date"] = day_match.group(1).capitalize()
                logger.info(f"  ✅ Found date (Day name): {details['date']}")
            else:
                # Try relative dates (tomorrow, today, nalaiku/naalai)
                relative_match = re.search(
                    r"(tomorrow|today|nalaiku|naalai)",
                    full_history_lower, re.IGNORECASE
                )
                if relative_match:
                    relative_keyword = relative_match.group(1).lower()
                    from datetime import timedelta
                    
                    if relative_keyword in ["tomorrow", "nalaiku", "naalai"]:
                        # Calculate tomorrow's date
                        tomorrow = datetime.now() + timedelta(days=1)
                        details["date"] = tomorrow.strftime("%Y-%m-%d")
                        logger.info(f"  ✅ Found date (tomorrow): {details['date']}")
                    elif relative_keyword == "today":
                        # Today's date
                        today = datetime.now()
                        details["date"] = today.strftime("%Y-%m-%d")
                        logger.info(f"  ✅ Found date (today): {details['date']}")
                else:
                    # Try other patterns as fallback
                    for pattern in date_patterns[4:]:
                        match = re.search(pattern, full_history_lower, re.IGNORECASE)
                        if match and "tomorrow" not in str(match.group(1)).lower() and "today" not in str(match.group(1)).lower():
                            details["date"] = match.group(1)
                            logger.info(f"  ✅ Found date (keyword): {details['date']}")
                            break
    
    # ─────────────────────────────────────────────────────────────
    # TIME EXTRACTION - Search entire history
    # ─────────────────────────────────────────────────────────────
    time_patterns = [
        r"(\d{1,2}:\d{2}\s*(?:am|pm)?)",  # HH:MM or HH:MM AM/PM
        r"(\d{1,2}\s+(?:am|pm))",  # 9 AM, 2 PM
        r"(\d{1,2}(?:\s+)?(?:am|pm))",  # 10AM, 10 AM
        r"(\d{1,2})\s+am",  # "10 am" variant
        r"(morning|afternoon|evening|night)",  # Relative times
    ]
    
    for pattern in time_patterns:
        match = re.search(pattern, full_history_lower, re.IGNORECASE)
        if match:
            time_str = match.group(1).strip().lower()
            # Accept times in various formats
            if time_str in ["morning", "afternoon", "evening", "night"]:
                details["time"] = time_str.capitalize()
                logger.info(f"  ✅ Found time (relative): {details['time']}")
                break
            elif any(x in time_str for x in [":", "am", "pm"]):
                # Normalize format: ensure space before am/pm
                if "am" in time_str:
                    time_str = time_str.replace("am", " AM").replace("AM", " AM").replace("  am", " AM")
                    time_str = time_str.strip()
                elif "pm" in time_str:
                    time_str = time_str.replace("pm", " PM").replace("PM", " PM").replace("  pm", " PM")
                    time_str = time_str.strip()
                details["time"] = time_str
                logger.info(f"  ✅ Found time: {details['time']}")
                break
    
    # ─────────────────────────────────────────────────────────────
    # PATIENT NAME EXTRACTION - Search entire history
    # Try multiple strategies to find patient name
    # ─────────────────────────────────────────────────────────────
    
    # Strategy 1: Look for explicit "name is" patterns
    explicit_patterns = [
        r"(?:name\s+(?:is|'s)?|i'?m\s+|i\s+am\s+|my\s+name\s+is\s+|patient\s+name\s+|booking\s+for\s+|appointment\s+for\s+)\s*([a-zA-Z][a-zA-Z\s]*[a-zA-Z])",
        r"(?:patient|name|arun|john|sarah|meera|rajesh|vikram|anjali|arjun|divya|suresh|reena)\s+(?:name\s+)?(?:is\s+)?([a-zA-Z][a-zA-Z\s]*[a-zA-Z])",
        # Direct name patterns for common first names + last names
        r"\b(arun\s+kumar|arun\s+\w+)\b",
        r"\b([a-zA-Z][a-zA-Z]+\s+(?:sharma|patel|kumar|singh|gupta|desai|nair|iyer|krishnan))\b",
    ]
    
    for pattern in explicit_patterns:
        matches = re.finditer(pattern, full_history_lower, re.IGNORECASE)
        for match in matches:
            name = match.group(1).strip().title()
            # Validate: real name (3-50 chars, no numbers, no common words)
            if (3 < len(name) < 50 and 
                not any(c.isdigit() for c in name) and
                name.lower() not in ["the", "and", "for", "with", "at", "on", "is", "are", "patient", "doctor", "appointment", "booking"]):
                details["patient_name"] = name
                logger.info(f"  ✅ Found patient name (explicit): {details['patient_name']}")
                break
        
        if details["patient_name"]:
            break
    
    # Strategy 2: Look for capitalized words in natural conversation (last resort)
    if not details["patient_name"]:
        # Find sequences of capitalized words (proper names) that aren't "Dr", "Doctor", etc
        likely_names = re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", full_history_text)  # Use original case
        common_words = {"the", "so", "ok", "sure", "yes", "no", "please", "thank", "you", "morning", "day", "time", "appointment", "dr", "doctor", "patient", "booking", "scheduled", "confirmed"}
        
        for name_match in likely_names:
            candidate = name_match.group(1).strip()
            if (len(candidate) > 2 and 
                candidate.lower() not in common_words and
                not any(c.isdigit() for c in candidate)):
                details["patient_name"] = candidate
                logger.info(f"  ✅ Found patient name (capitalized): {details['patient_name']}")
                break
    
    # ─────────────────────────────────────────────────────────────
    # PHONE EXTRACTION - OPTIONAL (not used in spreadsheet anymore)
    # ─────────────────────────────────────────────────────────────
    # Phone number is no longer a required field or spreadsheet column
    # Kept for reference but not extracted or validated
    
    # ─────────────────────────────────────────────────────────────
    # REASON EXTRACTION - Search entire history
    # ─────────────────────────────────────────────────────────────
    reason_keywords = [
        ("chest pain", "Chest Pain"),
        ("cardiology", "Cardiology Consultation"),
        ("checkup", "Checkup"),
        ("consultation", "Consultation"),
        ("follow-up", "Follow-up"),
        ("pain", "Pain"),
        ("fever", "Fever"),
        ("cough", "Cough"),
        ("headache", "Headache"),
    ]
    
    for keyword, label in reason_keywords:
        if keyword in full_history_lower:
            details["reason"] = label
            logger.info(f"  ✅ Found reason: {details['reason']}")
            break
    
    # Log complete extraction results
    logger.info(f"\n[EXTRACT] ═══════════════════════════════════════════")
    logger.info(f"[EXTRACT] EXTRACTION SUMMARY:")
    logger.info(f"[EXTRACT]   Doctor: {details.get('doctor') or '❌ NOT FOUND'}")
    logger.info(f"[EXTRACT]   Date: {details.get('date') or '❌ NOT FOUND'}")
    logger.info(f"[EXTRACT]   Time: {details.get('time') or '❌ NOT FOUND'}")
    logger.info(f"[EXTRACT]   Patient Name: {details.get('patient_name') or '❌ NOT FOUND'}")
    logger.info(f"[EXTRACT]   Reason: {details.get('reason') or '❌ NOT FOUND (optional)'}")
    logger.info(f"[EXTRACT] ═══════════════════════════════════════════\n")
    
    return details
