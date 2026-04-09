"""Hospital appointment booking service with Google Sheets integration.

Uses two sheets:
- Sheet 1 (Master): Doctor data - FLEXIBLE STRUCTURE (agent auto-detects columns)
- Sheet 2 (Booking): Maintains booking schedule - AUTO-CREATED if missing

Agent intelligently analyzes Sheet 1 to find:
- Doctor Name column (searches for "doctor", "name", "provider")
- Available Times column (searches for "time", "available", "slot")

Agent auto-creates Sheet 2 with proper structure if missing.
"""

from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import json
import logging
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

# Google Sheets API scopes
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


class HospitalBookingManager:
    """Manages doctor availability and patient bookings via Google Sheets."""

    def __init__(self, credentials_json: str, sheet_id_master: str, sheet_id_bookings: str):
        """
        Initialize hospital booking manager.
        
        Args:
            credentials_json: Google Sheets API credentials (JSON string)
            sheet_id_master: Sheet 1 ID for doctor master data (flexible structure)
            sheet_id_bookings: Sheet 2 ID for booking schedule (auto-created if needed)
        """
        self.sheet_id_master = sheet_id_master
        self.sheet_id_bookings = sheet_id_bookings
        
        try:
            # Parse credentials
            creds_dict = json.loads(credentials_json) if credentials_json else {}
            if creds_dict:
                credentials = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
                self.sheets_service = build('sheets', 'v4', credentials=credentials)
            else:
                self.sheets_service = None
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets: {e}")
            self.sheets_service = None

    def _detect_columns(self, rows: List[List[str]]) -> Dict[str, int]:
        """
        Intelligently detect column indices from sheet data.
        Looks for header patterns like "doctor", "name", "time", "available", etc.
        
        Returns: {column_name: column_index}
        """
        if not rows:
            return {}
        
        header_row = rows[0] if rows else []
        detected = {}
        
        # Search patterns for each column type
        patterns = {
            'doctor_name': ['doctor', 'name', 'provider', 'physician', 'specialist'],
            'available_times': ['time', 'available', 'slot', 'hours', 'timing', 'schedule'],
            'specialization': ['specialization', 'specialty', 'department', 'spec'],
        }
        
        # Find matching columns
        for col_idx, header in enumerate(header_row):
            if not header:
                continue
            header_lower = str(header).lower().strip()
            
            for col_type, keywords in patterns.items():
                if col_type not in detected:  # Only find first match
                    for keyword in keywords:
                        if keyword in header_lower:
                            detected[col_type] = col_idx
                            break
        
        return detected

    def get_doctor_availability(self, doctor_name: str, date: str) -> List[str]:
        """
        Get TRULY available time slots for a doctor on a specific date.
        This checks both:
        1. Doctor's configured available times (from Sheet 1)
        2. Already booked slots (from Sheet 2)
        
        Returns only slots that are both configured AND not yet booked.
        
        Args:
            doctor_name: Name of the doctor
            date: Date in YYYY-MM-DD format (e.g., "2026-04-15")
            
        Returns:
            List of available time slots (e.g., ["09:00", "09:30", "10:00"])
        """
        if not self.sheets_service:
            return []

        try:
            # STEP 1: Get configured available times from Sheet 1
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id_master,
                range="Sheet1!A:Z"  # Read all columns
            ).execute()
            
            rows = result.get('values', [])
            if len(rows) < 2:
                return []
            
            # Detect columns intelligently
            columns = self._detect_columns(rows)
            doctor_col = columns.get('doctor_name', 0)
            times_col = columns.get('available_times', 2)
            
            # Find doctor and extract times
            available_slots = []
            for row in rows[1:]:  # Skip header
                if len(row) > doctor_col and row[doctor_col]:
                    if row[doctor_col].strip().lower() == doctor_name.lower():
                        # Extract times from found column
                        if len(row) > times_col and row[times_col]:
                            times = row[times_col].split(",")
                            available_slots = [t.strip() for t in times if t.strip()]
                        break
            
            logger.info(f"📅 Doctor {doctor_name} has {len(available_slots)} configured slots: {available_slots}")
            
            # STEP 2: Get already booked slots from Sheet 2
            booked_slots = []
            try:
                result2 = self.sheets_service.spreadsheets().values().get(
                    spreadsheetId=self.sheet_id_bookings,
                    range="Sheet1!A:D"  # Doctor | Date | Time | Patient
                ).execute()
                
                booking_rows = result2.get('values', [])[1:]  # Skip header
                
                for booking in booking_rows:
                    if (len(booking) >= 3 and 
                        booking[0].strip().lower() == doctor_name.lower() and
                        booking[1].strip() == date):
                        booked_slots.append(booking[2].strip())
                        logger.info(f"  ⏳ Slot {booking[2].strip()} already booked")
            except Exception as e:
                logger.warning(f"Could not check booked slots: {e}")
            
            # STEP 3: Return available slots that are NOT booked
            free_slots = [slot for slot in available_slots if slot not in booked_slots]
            logger.info(f"✅ Free slots for {doctor_name} on {date}: {free_slots}")
            
            return free_slots
            
        except Exception as e:
            logger.error(f"Error fetching doctor availability: {e}")
            return []

    def _ensure_sheet2_headers(self) -> Dict[str, Any]:
        """
        Ensure Sheet 2 has proper headers. Creates them if missing.
        
        Returns: Dict with result and debugging info
        """
        if not self.sheets_service:
            return {
                "success": False,
                "error": "No sheets service available",
                "sheet_id": self.sheet_id_bookings
            }

        try:
            logger.info(f"🔍 [Step 1] Reading Sheet 2 headers from {self.sheet_id_bookings}")
            
            # Read first row
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id_bookings,
                range="Sheet1!A1:H1"
            ).execute()
            
            rows = result.get('values', [])
            headers = rows[0] if rows else []
            logger.info(f"📖 Current headers in Sheet 2: {headers}")
            
            # Check if headers exist and are correct
            expected_headers = ['Doctor Name', 'Date', 'Time Slot', 'Patient Name', 
                              'Reason', 'Created At', 'Status']
            
            if not headers or headers != expected_headers:
                logger.info(f"🔧 Updating headers from {headers} to {expected_headers}")
                # Create/update headers
                update_result = self.sheets_service.spreadsheets().values().update(
                    spreadsheetId=self.sheet_id_bookings,
                    range="Sheet1!A1:H1",
                    valueInputOption="USER_ENTERED",
                    body={"values": [expected_headers]}
                ).execute()
                logger.info(f"✅ Sheet 2 headers created/updated: {update_result.get('updatedRange', 'N/A')}")
                return {
                    "success": True,
                    "action": "created_headers",
                    "updated_range": update_result.get('updatedRange'),
                    "updated_cells": update_result.get('updatedCells')
                }
            else:
                logger.info("✅ Sheet 2 headers already correct")
                return {
                    "success": True,
                    "action": "headers_exist",
                    "current_headers": headers
                }
        except Exception as e:
            logger.error(f"❌ Error ensuring Sheet 2 headers: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "sheet_id": self.sheet_id_bookings
            }

    def check_booking_conflict(self, doctor_name: str, date: str, time_slot: str) -> bool:
        """
        Check if time slot is already booked in Sheet 2.
        
        Args:
            doctor_name: Doctor name
            date: Date in YYYY-MM-DD format
            time_slot: Time in HH:MM format
            
        Returns:
            True if slot is available, False if booked
        """
        if not self.sheets_service:
            return False

        try:
            # Ensure headers first
            self._ensure_sheet2_headers()
            
            # Read Sheet 2 (Bookings)
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id_bookings,
                range="Sheet1!A:D"
            ).execute()
            
            rows = result.get('values', [])[1:]  # Skip header
            
            for booking in rows:
                if (len(booking) >= 3 and 
                    booking[0].strip().lower() == doctor_name.lower() and
                    booking[1].strip() == date and
                    booking[2].strip() == time_slot):
                    return False  # Slot is booked
            
            return True  # Slot is available
        except Exception as e:
            logger.error(f"Error checking booking conflict: {e}")
            return False

    def create_booking(self, doctor_name: str, date: str, time_slot: str, 
                      patient_name: str, reason: str) -> Dict[str, Any]:
        """
        Create a new appointment booking in Sheet 2 with atomic write.
        Auto-creates Sheet 2 structure if needed.
        
        Args:
            doctor_name: Doctor name
            date: Date in YYYY-MM-DD format
            time_slot: Time in HH:MM format
            patient_name: Patient name
            reason: Reason for appointment
            
        Returns:
            Dict with booking details or error
        """
        if not self.sheets_service:
            logger.warning("⚠️  Sheets service not available - no credentials provided")
            return {
                "success": False,
                "error": "Google Sheets API not configured",
                "details": "Please provide a valid Google Service Account JSON in hospital config",
                "debugging": {
                    "sheets_service": None,
                    "sheet_id_1": self.sheet_id_master,
                    "sheet_id_2": self.sheet_id_bookings
                }
            }

        try:
            logger.info(f"=" * 60)
            logger.info(f"📅 BOOKING REQUEST")
            logger.info(f"Patient: {patient_name}")
            logger.info(f"Doctor: {doctor_name}")
            logger.info(f"Date: {date}, Time: {time_slot}")
            logger.info(f"=" * 60)
            
            # STEP 1: Ensure Sheet 2 has proper structure
            logger.info("\n🔧 [STEP 1/4] Ensuring Sheet 2 structure...")
            headers_result = self._ensure_sheet2_headers()
            if not headers_result.get("success"):
                logger.error(f"❌ Failed to setup Sheet 2: {headers_result.get('error')}")
                return {
                    "success": False,
                    "error": f"Failed to setup Sheet 2: {headers_result.get('error')}",
                    "step": 1,
                    "diagnosis": headers_result
                }
            logger.info(f"✅ Sheet 2 ready: {headers_result.get('action')}")
            
            # STEP 2: Check if slot is available
            logger.info("\n🔍 [STEP 2/4] Checking for booking conflict...")
            logger.info(f"Query: Doctor={doctor_name}, Date={date}, Time={time_slot}")
            
            if not self.check_booking_conflict(doctor_name, date, time_slot):
                available = self.get_doctor_availability(doctor_name, date)
                logger.warning(f"⚠️  Slot {time_slot} on {date} already booked")
                logger.info(f"Available slots: {available}")
                return {
                    "success": False,
                    "error": f"Time slot {time_slot} on {date} is already booked. Please choose another time.",
                    "available_slots": available,
                    "step": 2
                }
            logger.info(f"✅ Slot available for booking")
            
            # STEP 3: Prepare booking data
            logger.info("\n📝 [STEP 3/4] Preparing booking data...")
            booking_data = [
                [doctor_name, date, time_slot, patient_name, reason, 
                 datetime.now().isoformat(), "scheduled"]
            ]
            logger.info(f"Booking row: {booking_data[0]}")
            
            # STEP 4: Write to Sheet 2
            logger.info("\n✍️  [STEP 4/4] Writing to Sheet 2...")
            logger.info(f"Target Sheet: {self.sheet_id_bookings}")
            logger.info(f"Range: Sheet1!A:H")
            
            result = self.sheets_service.spreadsheets().values().append(
                spreadsheetId=self.sheet_id_bookings,
                range="Sheet1!A:H",
                valueInputOption="USER_ENTERED",
                body={"values": booking_data}
            ).execute()
            
            logger.info(f"✅ Write successful!")
            logger.info(f"Updated range: {result.get('updates', {}).get('updatedRange', 'N/A')}")
            logger.info(f"Updated rows: {result.get('updates', {}).get('updatedRows', 'N/A')}")
            logger.info(f"Updated cells: {result.get('updates', {}).get('updatedCells', 'N/A')}")
            
            logger.info(f"\n{'='*60}")
            logger.info(f"✅ BOOKING COMPLETED SUCCESSFULLY")
            logger.info(f"{'='*60}\n")
            
            return {
                "success": True,
                "message": f"Appointment booked successfully!",
                "booking_details": {
                    "doctor": doctor_name,
                    "date": date,
                    "time": time_slot,
                    "patient": patient_name,
                    "status": "scheduled"
                },
                "debugging": {
                    "sheet_2_id": self.sheet_id_bookings,
                    "updated_range": result.get('updates', {}).get('updatedRange'),
                    "updated_rows": result.get('updates', {}).get('updatedRows'),
                    "updated_cells": result.get('updates', {}).get('updatedCells')
                }
            }
        except Exception as e:
            logger.error(f"\n{'='*60}")
            logger.error(f"❌ BOOKING FAILED AT ERROR STEP")
            logger.error(f"Error: {e}")
            logger.error(f"Type: {type(e).__name__}")
            logger.error(f"Doctor: {doctor_name}, Date: {date}, Time: {time_slot}")
            logger.error(f"Sheet 2 ID: {self.sheet_id_bookings}")
            logger.error(f"{'='*60}\n")
            
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            return {
                "success": False,
                "error": f"Failed to create booking: {str(e)}",
                "error_type": type(e).__name__,
                "debugging": {
                    "sheet_1_id": self.sheet_id_master,
                    "sheet_2_id": self.sheet_id_bookings,
                    "doctor": doctor_name,
                    "date": date,
                    "time": time_slot,
                    "python_error": str(e),
                    "solution": "Check backend logs for detailed traceback"
                }
            }

    def get_all_bookings(self, doctor_name: Optional[str] = None) -> List[Dict]:
        """
        Get all bookings from Sheet 2, optionally filtered by doctor.
        
        Args:
            doctor_name: Optional doctor name filter
            
        Returns:
            List of booking dictionaries
        """
        if not self.sheets_service:
            return []

        try:
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id_bookings,
                range="Sheet1!A:H"
            ).execute()
            
            rows = result.get('values', [])[1:]  # Skip header
            bookings = []
            
            for row in rows:
                if len(row) >= 4:
                    doc_name = row[0].strip()
                    if doctor_name and doc_name.lower() != doctor_name.lower():
                        continue
                    
                    bookings.append({
                        "doctor": doc_name,
                        "date": row[1] if len(row) > 1 else "",
                        "time": row[2] if len(row) > 2 else "",
                        "patient": row[3] if len(row) > 3 else "",
                        "phone": row[4] if len(row) > 4 else "",
                        "reason": row[5] if len(row) > 5 else "",
                        "status": row[7] if len(row) > 7 else "scheduled"
                    })
            
            return bookings
        except Exception as e:
            logger.error(f"Error fetching bookings: {e}")
            return []

    def update_booking_status(self, doctor_name: str, date: str, time_slot: str, 
                             new_status: str) -> bool:
        """
        Update booking status in Sheet 2.
        
        Args:
            doctor_name: Doctor name
            date: Date in YYYY-MM-DD format
            time_slot: Time in HH:MM format
            new_status: New status (completed, cancelled, no-show)
            
        Returns:
            True if update succeeded
        """
        if not self.sheets_service:
            return False

        try:
            # Read all bookings
            result = self.sheets_service.spreadsheets().values().get(
                spreadsheetId=self.sheet_id_bookings,
                range="Sheet1!A:H"
            ).execute()
            
            rows = result.get('values', [])
            target_row = None
            
            for idx, row in enumerate(rows[1:], start=2):  # Skip header, rows are 1-indexed
                if (len(row) >= 3 and 
                    row[0].strip().lower() == doctor_name.lower() and
                    row[1].strip() == date and
                    row[2].strip() == time_slot):
                    target_row = idx
                    break
            
            if target_row:
                # Update status in column H
                self.sheets_service.spreadsheets().values().update(
                    spreadsheetId=self.sheet_id_bookings,
                    range=f"Sheet1!H{target_row}",
                    valueInputOption="USER_ENTERED",
                    body={"values": [[new_status]]}
                ).execute()
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error updating booking status: {e}")
            return False

