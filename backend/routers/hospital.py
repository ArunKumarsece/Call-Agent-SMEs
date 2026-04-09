"""Hospital appointment booking routes for voice agents."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import Agent, Company
from schemas import AgentResponse
from services.auth_service import get_current_company
from services.hospital_booking import HospitalBookingManager
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/hospital", tags=["hospital"])


# ─── Request/Response Models ─────────────────────────────────────────────────

class BookingRequest(BaseModel):
    doctor_name: str
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM
    patient_name: str
    reason: Optional[str] = None


class AvailableSlotsRequest(BaseModel):
    doctor_name: str
    date: str


class BookingStatusUpdate(BaseModel):
    status: str  # completed, cancelled, no-show


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/available-slots", response_model=List[str])
async def get_available_slots(
    agent_id: str,
    request_body: AvailableSlotsRequest,
    db: Session = Depends(get_db),
):
    """Get available time slots for a doctor on a specific date."""
    agent = _get_agent_with_hospital_config(agent_id, None, db)
    
    manager = _init_hospital_manager(agent)
    available_slots = manager.get_doctor_availability(request_body.doctor_name, request_body.date)
    
    return available_slots


@router.post("/{agent_id}/book-appointment")
async def book_appointment(
    agent_id: str,
    booking: BookingRequest,
    db: Session = Depends(get_db),
):
    """Book an appointment with conflict resolution."""
    agent = _get_agent_with_hospital_config(agent_id, None, db)
    
    manager = _init_hospital_manager(agent)
    result = manager.create_booking(
        doctor_name=booking.doctor_name,
        date=booking.date,
        time_slot=booking.time_slot,
        patient_name=booking.patient_name,
        reason=booking.reason or "General checkup"
    )
    
    if not result.get('success') and 'available_slots' in result:
        raise HTTPException(status_code=409, detail=result)
    
    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('error', 'Booking failed'))
    
    return result


@router.get("/{agent_id}/bookings")
async def get_bookings(
    agent_id: str,
    doctor_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all bookings for an agent, optionally filtered by doctor."""
    agent = _get_agent_with_hospital_config(agent_id, None, db)
    
    manager = _init_hospital_manager(agent)
    bookings = manager.get_all_bookings(doctor_name=doctor_name)
    
    return {"bookings": bookings, "total": len(bookings)}


@router.put("/{agent_id}/booking/{booking_id}/status")
async def update_booking_status(
    agent_id: str,
    booking_id: str,
    update: BookingStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update booking status (completed, cancelled, no-show)."""
    agent = _get_agent_with_hospital_config(agent_id, None, db)
    
    manager = _init_hospital_manager(agent)
    # Parse booking_id in format: doctor_name|date|time_slot
    parts = booking_id.split('|')
    if len(parts) != 3:
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
    
    doctor_name, date, time_slot = parts
    success = manager.update_booking_status(doctor_name, date, time_slot, update.status)
    
    if not success:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"message": f"Booking status updated to {update.status}", "booking_id": booking_id}


@router.get("/debug/agents")
async def debug_get_agents(
    db: Session = Depends(get_db),
):
    """DEBUG ENDPOINT: List all agents with hospital config status."""
    agents = db.query(Agent).all()  # No company filter - show all for debugging
    
    result = []
    for agent in agents:
        result.append({
            "agent_id": agent.id,
            "agent_name": agent.name,
            "has_hospital_config": bool(agent.hospital_config),
            "hospital_config": {
                "sheet_id_1": agent.hospital_config.get('sheet_id_1') if agent.hospital_config else None,
                "sheet_id_2": agent.hospital_config.get('sheet_id_2') if agent.hospital_config else None,
                "has_credentials": bool(agent.hospital_config.get('credentials_json')) if agent.hospital_config else False,
                "credentials_length": len(agent.hospital_config.get('credentials_json', '')) if agent.hospital_config else 0
            }
        })
    
    return {
        "total_agents": len(agents),
        "agents_with_hospital": sum(1 for a in result if a['has_hospital_config']),
        "agents": result
    }


@router.post("/debug/{agent_id}/step-by-step")
async def debug_step_by_step(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """DEBUG ENDPOINT: Test each step of booking process individually."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.hospital_config:
        return {
            "success": False,
            "error": "Hospital booking not configured",
            "solution": "Enable hospital booking when creating/editing agent"
        }
    
    steps = {
        "agent_id": agent_id,
        "agent_name": agent.name,
        "timestamp": datetime.now().isoformat(),
        "steps": {}
    }
    
    try:
        # STEP 1: Check credentials
        steps["steps"]["1_credentials"] = {
            "name": "Check Google Service Account Credentials",
            "status": "testing..."
        }
        
        has_creds = bool(agent.hospital_config.get('credentials_json'))
        if not has_creds:
            steps["steps"]["1_credentials"]["status"] = "❌ MISSING"
            steps["steps"]["1_credentials"]["error"] = "No Service Account JSON provided"
            steps["steps"]["1_credentials"]["solution"] = "Paste Service Account JSON in hospital config"
            return steps
        
        steps["steps"]["1_credentials"]["status"] = "✅ FOUND"
        steps["steps"]["1_credentials"]["details"] = "Service Account JSON is present"
        
        # STEP 2: Initialize manager
        steps["steps"]["2_initialize_manager"] = {
            "name": "Initialize Google Sheets Manager",
            "status": "testing..."
        }
        
        try:
            manager = _init_hospital_manager(agent)
            if not manager.sheets_service:
                steps["steps"]["2_initialize_manager"]["status"] = "❌ FAILED"
                steps["steps"]["2_initialize_manager"]["error"] = "Sheets service is None"
                steps["steps"]["2_initialize_manager"]["solution"] = "JSON credentials might be invalid or malformed"
                return steps
            
            steps["steps"]["2_initialize_manager"]["status"] = "✅ SUCCESS"
            steps["steps"]["2_initialize_manager"]["details"] = "Google Sheets API service initialized"
        except Exception as e:
            steps["steps"]["2_initialize_manager"]["status"] = "❌ ERROR"
            steps["steps"]["2_initialize_manager"]["error"] = str(e)
            steps["steps"]["2_initialize_manager"]["solution"] = "Check Service Account JSON validity"
            return steps
        
        # STEP 3: Read Sheet 1
        steps["steps"]["3_read_sheet1"] = {
            "name": "Read Sheet 1 (Doctor Master Data)",
            "sheet_id": agent.hospital_config.get('sheet_id_1'),
            "status": "testing..."
        }
        
        try:
            result = manager.sheets_service.spreadsheets().values().get(
                spreadsheetId=agent.hospital_config.get('sheet_id_1'),
                range="Sheet1!A:Z"
            ).execute()
            
            rows = result.get('values', [])
            steps["steps"]["3_read_sheet1"]["status"] = "✅ SUCCESS"
            steps["steps"]["3_read_sheet1"]["details"] = {
                "total_rows": len(rows),
                "header_row": rows[0] if rows else [],
                "sample_data": rows[1:3] if len(rows) > 1 else "No data rows"
            }
        except Exception as e:
            steps["steps"]["3_read_sheet1"]["status"] = "❌ ERROR"
            steps["steps"]["3_read_sheet1"]["error"] = str(e)
            steps["steps"]["3_read_sheet1"]["solution"] = "Sheet 1 ID might be wrong or not shared with service account"
            return steps
        
        # STEP 4: Read Sheet 2
        steps["steps"]["4_read_sheet2"] = {
            "name": "Read Sheet 2 (Booking Schedule)",
            "sheet_id": agent.hospital_config.get('sheet_id_2'),
            "status": "testing..."
        }
        
        try:
            result = manager.sheets_service.spreadsheets().values().get(
                spreadsheetId=agent.hospital_config.get('sheet_id_2'),
                range="Sheet1!A:H"
            ).execute()
            
            rows = result.get('values', [])
            steps["steps"]["4_read_sheet2"]["status"] = "✅ SUCCESS"
            steps["steps"]["4_read_sheet2"]["details"] = {
                "total_rows": len(rows),
                "header_row": rows[0] if rows else "No headers",
                "expected_headers": ['Doctor Name', 'Date', 'Time Slot', 'Patient Name', 'Patient Phone', 'Reason', 'Created At', 'Status'],
                "booking_rows": len(rows) - 1 if rows else 0
            }
        except Exception as e:
            steps["steps"]["4_read_sheet2"]["status"] = "❌ ERROR"
            steps["steps"]["4_read_sheet2"]["error"] = str(e)
            steps["steps"]["4_read_sheet2"]["solution"] = "Sheet 2 ID might be wrong or not shared with service account"
            return steps
        
        # STEP 5: Test write to Sheet 2
        steps["steps"]["5_test_write"] = {
            "name": "Test Write to Sheet 2",
            "status": "testing..."
        }
        
        try:
            test_data = [["TEST_DOCTOR", "2025-04-15", "10:00", "TEST_PATIENT", "+91-9999999999", "Debug Test", datetime.now().isoformat(), "test"]]
            
            write_result = manager.sheets_service.spreadsheets().values().append(
                spreadsheetId=agent.hospital_config.get('sheet_id_2'),
                range="Sheet1!A:H",
                valueInputOption="USER_ENTERED",
                body={"values": test_data}
            ).execute()
            
            steps["steps"]["5_test_write"]["status"] = "✅ SUCCESS"
            steps["steps"]["5_test_write"]["details"] = {
                "updated_range": write_result.get('updates', {}).get('updatedRange'),
                "updated_rows": write_result.get('updates', {}).get('updatedRows'),
                "updated_cells": write_result.get('updates', {}).get('updatedCells'),
                "message": "✅ Can write to Sheet 2! Check if test row appeared."
            }
        except Exception as e:
            steps["steps"]["5_test_write"]["status"] = "❌ ERROR"
            steps["steps"]["5_test_write"]["error"] = str(e)
            steps["steps"]["5_test_write"]["solution"] = "Service account might not have Write permission. Check Sheet 2 sharing."
            return steps
        
        # ALL GOOD
        steps["overall_status"] = "✅ ALL SYSTEMS GO"
        steps["next_step"] = "Try booking! If it still doesn't work, check backend logs for detailed error."
        
        return steps
        
    except Exception as e:
        steps["overall_status"] = "❌ UNEXPECTED ERROR"
        steps["error"] = str(e)
        return steps


@router.post("/debug/{agent_id}/test-write-only")
async def debug_test_write_only(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """DEBUG ENDPOINT: Test ONLY the write operation to Sheet 2."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    
    if not agent or not agent.hospital_config:
        raise HTTPException(status_code=400, detail="Agent or hospital config not found")
    
    try:
        manager = _init_hospital_manager(agent)
        
        if not manager.sheets_service:
            return {
                "success": False,
                "error": "No sheets service - invalid credentials",
                "sheet_id_2": agent.hospital_config.get('sheet_id_2')
            }
        
        # Just try to write
        test_row = [[
            "Dr. TEST",
            "2025-04-15",
            "10:00",
            "Patient TEST",
            "+91-1234567890",
            "Debug Write Test",
            datetime.now().isoformat(),
            "debug"
        ]]
        
        result = manager.sheets_service.spreadsheets().values().append(
            spreadsheetId=agent.hospital_config.get('sheet_id_2'),
            range="Sheet1!A:H",
            valueInputOption="USER_ENTERED",
            body={"values": test_row}
        ).execute()
        
        return {
            "success": True,
            "message": "✅ Written to Sheet 2!",
            "details": {
                "updated_range": result.get('updates', {}).get('updatedRange'),
                "updated_rows": result.get('updates', {}).get('updatedRows'),
                "updated_cells": result.get('updates', {}).get('updatedCells'),
                "instruction": "Check Sheet 2 - you should see a row with 'Dr. TEST' and 'Patient TEST'"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "sheet_id_2": agent.hospital_config.get('sheet_id_2'),
            "solution": "Sheet 2 ID might be wrong or service account doesn't have write access"
        }


@router.post("/debug/{agent_id}/diagnose")
async def diagnose_agent(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """DEBUG ENDPOINT: Full diagnostic check for an agent."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    diagnosis = {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "timestamp": datetime.now().isoformat(),
        "hospital_booking": {
            "enabled": bool(agent.hospital_config),
        }
    }
    
    if not agent.hospital_config:
        diagnosis["hospital_booking"]["status"] = "❌ NOT CONFIGURED"
        diagnosis["hospital_booking"]["next_step"] = "Create or edit agent and enable 'Hospital Booking' toggle in Step 1"
        return diagnosis
    
    diagnosis["hospital_booking"]["sheet_id_1"] = agent.hospital_config.get('sheet_id_1')
    diagnosis["hospital_booking"]["sheet_id_2"] = agent.hospital_config.get('sheet_id_2')
    
    # Check if credentials exist
    has_creds = bool(agent.hospital_config.get('credentials_json'))
    diagnosis["hospital_booking"]["has_service_account"] = has_creds
    
    if not has_creds:
        diagnosis["hospital_booking"]["status"] = "⚠️  PARTIALLY CONFIGURED"
        diagnosis["hospital_booking"]["issue"] = "No Service Account JSON provided"
        diagnosis["hospital_booking"]["details"] = "Without Service Account, bookings cannot be written to Sheet 2"
        diagnosis["hospital_booking"]["solution"] = "Create a Google Service Account and paste JSON in 'Google Service Account JSON' field"
        return diagnosis
    
    # Try to init manager and test
    try:
        manager = _init_hospital_manager(agent)
        if not manager.sheets_service:
            diagnosis["hospital_booking"]["status"] = "❌ CREDENTIALS INVALID"
            diagnosis["hospital_booking"]["issue"] = "Service Account JSON is invalid or malformed"
            diagnosis["hospital_booking"]["solution"] = "Verify the Service Account JSON is valid - check for typos, extra quotes, etc."
            return diagnosis
        
        # Try to test connection
        test_slots = manager.get_doctor_availability("Test", "2025-01-01")
        diagnosis["hospital_booking"]["status"] = "✅ FULLY CONFIGURED"
        diagnosis["hospital_booking"]["connection_test"] = {
            "sheet_1_readable": True,
            "test_query_result": f"Returned {len(test_slots)} slots"
        }
        
    except Exception as e:
        diagnosis["hospital_booking"]["status"] = "❌ ERROR CONNECTING"
        diagnosis["hospital_booking"]["error"] = str(e)
        diagnosis["hospital_booking"]["error_type"] = type(e).__name__
        diagnosis["hospital_booking"]["solution"] = "Check backend logs for detailed error message"
    
    return diagnosis


@router.post("/{agent_id}/test-connection")
async def test_sheets_connection(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """Test connection to configured Google Sheets."""
    agent = _get_agent_with_hospital_config(agent_id, None, db)
    
    try:
        manager = _init_hospital_manager(agent)
        
        # Check if manager has service
        if not manager.sheets_service:
            return {
                "success": False,
                "message": "❌ No Google Sheets API service available",
                "issue": "Service Account JSON not provided or invalid",
                "solution": "Provide a valid Google Service Account JSON in hospital config",
                "sheet_1_id": agent.hospital_config.get('sheet_id_1'),
                "sheet_2_id": agent.hospital_config.get('sheet_id_2'),
                "has_credentials": bool(agent.hospital_config.get('credentials_json'))
            }
        
        # Try to read from Sheet 1
        slots = manager.get_doctor_availability("Test", "2025-01-01")
        return {
            "success": True,
            "message": "✅ Connection to Google Sheets successful",
            "sheet_1_id": agent.hospital_config.get('sheet_id_1'),
            "sheet_2_id": agent.hospital_config.get('sheet_id_2'),
            "can_read_sheet1": True,
            "sample_result": f"Read returned {len(slots) if slots else 0} slots"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"❌ Connection failed: {str(e)}",
            "error": str(e),
            "sheet_1_id": agent.hospital_config.get('sheet_id_1'),
            "sheet_2_id": agent.hospital_config.get('sheet_id_2'),
            "has_credentials": bool(agent.hospital_config.get('credentials_json'))
        }


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _optional_auth(request: Request):
    """Get current company if authenticated, otherwise return None."""
    try:
        from services.auth_service import get_current_company as get_company
        return await get_company(request)
    except:
        return None


def _get_agent_with_hospital_config(agent_id: str, company_id: Optional[str], db: Session) -> Agent:
    """Get agent and verify hospital config exists. Works with or without company_id."""
    query = db.query(Agent).filter(Agent.id == agent_id)
    
    # If company_id provided, verify company ownership
    if company_id:
        query = query.filter(Agent.company_id == company_id)
    
    agent = query.first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.hospital_config or not agent.hospital_config.get('sheet_id_1'):
        raise HTTPException(
            status_code=400,
            detail="Hospital booking not configured for this agent"
        )
    
    return agent


def _init_hospital_manager(agent: Agent) -> HospitalBookingManager:
    """Initialize HospitalBookingManager from agent config."""
    config = agent.hospital_config
    return HospitalBookingManager(
        credentials_json=config.get('credentials_json', '{}'),
        sheet_id_master=config.get('sheet_id_1'),
        sheet_id_bookings=config.get('sheet_id_2'),
    )
