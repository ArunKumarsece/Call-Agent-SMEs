"""Appointment management API for hospital systems."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Doctor, DoctorTimeSlot, Appointment, Company
from schemas import (
    DoctorCreate, DoctorUpdate, DoctorResponse,
    DoctorTimeSlotCreate, DoctorTimeSlotResponse,
    AppointmentCreate, AppointmentUpdate, AppointmentResponse
)
from routers.auth import get_current_company
from datetime import datetime, timedelta, timezone
import uuid

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


# ═══════════════════════════════════════════════════════════════════════════
# DOCTOR MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/doctors", response_model=DoctorResponse)
async def create_doctor(
    doctor_data: DoctorCreate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Create a new doctor profile."""
    new_doctor = Doctor(
        company_id=company.id,
        name=doctor_data.name,
        specialization=doctor_data.specialization,
        license_number=doctor_data.license_number,
        phone=doctor_data.phone,
        email=doctor_data.email,
        bio=doctor_data.bio,
        years_experience=doctor_data.years_experience,
        avatar_url=doctor_data.avatar_url,
        is_active=True
    )
    db.add(new_doctor)
    db.commit()
    db.refresh(new_doctor)
    return {
        "id": new_doctor.id,
        "name": new_doctor.name,
        "specialization": new_doctor.specialization,
        "license_number": new_doctor.license_number,
        "phone": new_doctor.phone,
        "email": new_doctor.email,
        "bio": new_doctor.bio,
        "years_experience": new_doctor.years_experience,
        "avatar_url": new_doctor.avatar_url,
        "is_active": new_doctor.is_active
    }


@router.get("/doctors", response_model=list)
async def list_doctors(
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """List all doctors for the company."""
    doctors = db.query(Doctor).filter(Doctor.company_id == company.id).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "specialization": d.specialization,
            "phone": d.phone,
            "email": d.email,
            "years_experience": d.years_experience,
            "avatar_url": d.avatar_url,
            "is_active": d.is_active
        }
        for d in doctors
    ]


@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(
    doctor_id: str,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Get doctor details."""
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {
        "id": doctor.id,
        "name": doctor.name,
        "specialization": doctor.specialization,
        "license_number": doctor.license_number,
        "phone": doctor.phone,
        "email": doctor.email,
        "bio": doctor.bio,
        "years_experience": doctor.years_experience,
        "avatar_url": doctor.avatar_url,
        "is_active": doctor.is_active
    }


@router.put("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: str,
    doctor_data: DoctorUpdate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Update doctor information."""
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    for field, value in doctor_data.dict(exclude_unset=True).items():
        setattr(doctor, field, value)
    
    db.commit()
    db.refresh(doctor)
    return {
        "id": doctor.id,
        "name": doctor.name,
        "specialization": doctor.specialization,
        "license_number": doctor.license_number,
        "phone": doctor.phone,
        "email": doctor.email,
        "bio": doctor.bio,
        "years_experience": doctor.years_experience,
        "avatar_url": doctor.avatar_url,
        "is_active": doctor.is_active
    }


# ═══════════════════════════════════════════════════════════════════════════
# TIME SLOTS MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/doctors/{doctor_id}/time-slots", response_model=DoctorTimeSlotResponse)
async def create_time_slot(
    doctor_id: str,
    slot_data: DoctorTimeSlotCreate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Create a time slot for doctor."""
    # Verify doctor belongs to company
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    new_slot = DoctorTimeSlot(
        doctor_id=doctor_id,
        day_of_week=slot_data.day_of_week,
        start_time=slot_data.start_time,
        end_time=slot_data.end_time,
        slot_duration_min=slot_data.slot_duration_min,
        is_available=True,
        max_patients=slot_data.max_patients,
        notes=slot_data.notes
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    return {
        "id": new_slot.id,
        "doctor_id": new_slot.doctor_id,
        "day_of_week": new_slot.day_of_week,
        "start_time": new_slot.start_time,
        "end_time": new_slot.end_time,
        "slot_duration_min": new_slot.slot_duration_min,
        "is_available": new_slot.is_available,
        "max_patients": new_slot.max_patients,
        "notes": new_slot.notes
    }


@router.get("/doctors/{doctor_id}/time-slots", response_model=list)
async def list_time_slots(
    doctor_id: str,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """List all time slots for doctor."""
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    slots = db.query(DoctorTimeSlot).filter(DoctorTimeSlot.doctor_id == doctor_id).all()
    return [
        {
            "id": s.id,
            "doctor_id": s.doctor_id,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "slot_duration_min": s.slot_duration_min,
            "is_available": s.is_available,
            "max_patients": s.max_patients,
            "notes": s.notes
        }
        for s in slots
    ]


# ═══════════════════════════════════════════════════════════════════════════
# APPOINTMENT BOOKING & MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/book", response_model=AppointmentResponse)
async def book_appointment(
    appointment_data: AppointmentCreate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Book an appointment with a doctor."""
    # Verify doctor exists
    doctor = db.query(Doctor).filter(
        Doctor.id == appointment_data.doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Create appointment
    new_appointment = Appointment(
        company_id=company.id,
        doctor_id=appointment_data.doctor_id,
        patient_name=appointment_data.patient_name,
        patient_phone=appointment_data.patient_phone,
        patient_email=appointment_data.patient_email,
        appointment_date=appointment_data.appointment_date,
        status="scheduled",
        reason=appointment_data.reason,
        is_confirmed=False
    )
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    
    return {
        "id": new_appointment.id,
        "doctor_id": new_appointment.doctor_id,
        "patient_name": new_appointment.patient_name,
        "patient_phone": new_appointment.patient_phone,
        "patient_email": new_appointment.patient_email,
        "appointment_date": new_appointment.appointment_date,
        "status": new_appointment.status,
        "reason": new_appointment.reason,
        "is_confirmed": new_appointment.is_confirmed
    }


@router.get("/doctor/{doctor_id}/schedule", response_model=list)
async def get_doctor_schedule(
    doctor_id: str,
    date_from: str = None,
    date_to: str = None,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Get all appointments for a doctor within a date range."""
    doctor = db.query(Doctor).filter(
        Doctor.id == doctor_id,
        Doctor.company_id == company.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    query = db.query(Appointment).filter(Appointment.doctor_id == doctor_id)
    
    if date_from:
        query = query.filter(Appointment.appointment_date >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Appointment.appointment_date <= datetime.fromisoformat(date_to))
    
    appointments = query.order_by(Appointment.appointment_date).all()
    return [
        {
            "id": a.id,
            "doctor_id": a.doctor_id,
            "patient_name": a.patient_name,
            "patient_phone": a.patient_phone,
            "patient_email": a.patient_email,
            "appointment_date": a.appointment_date.isoformat(),
            "status": a.status,
            "reason": a.reason,
            "is_confirmed": a.is_confirmed,
            "notes": a.notes
        }
        for a in appointments
    ]


@router.get("/appointments", response_model=list)
async def list_appointments(
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """List all appointments for company."""
    appointments = db.query(Appointment).filter(Appointment.company_id == company.id).all()
    return [
        {
            "id": a.id,
            "doctor_id": a.doctor_id,
            "doctor_name": a.doctor.name if a.doctor else "Unknown",
            "doctor_specialization": a.doctor.specialization if a.doctor else "Unknown",
            "patient_name": a.patient_name,
            "patient_phone": a.patient_phone,
            "patient_email": a.patient_email,
            "appointment_date": a.appointment_date.isoformat(),
            "status": a.status,
            "reason": a.reason,
            "is_confirmed": a.is_confirmed,
            "notes": a.notes,
            "created_at": a.created_at.isoformat()
        }
        for a in appointments
    ]


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    appointment_data: AppointmentUpdate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Update appointment status or details."""
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.company_id == company.id
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    for field, value in appointment_data.dict(exclude_unset=True).items():
        setattr(appointment, field, value)
    
    appointment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appointment)
    return {
        "id": appointment.id,
        "doctor_id": appointment.doctor_id,
        "patient_name": appointment.patient_name,
        "patient_phone": appointment.patient_phone,
        "patient_email": appointment.patient_email,
        "appointment_date": appointment.appointment_date,
        "status": appointment.status,
        "reason": appointment.reason,
        "is_confirmed": appointment.is_confirmed
    }
