from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
import jwt
from passlib.context import CryptContext
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
import io
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Mount uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Enums
class UserRole(str, Enum):
    admin = "admin"
    owner = "owner"
    procurement_manager = "procurement_manager"
    production_supervisor = "production_supervisor"
    cold_storage_incharge = "cold_storage_incharge"
    qc_officer = "qc_officer"
    sales_manager = "sales_manager"
    accounts_manager = "accounts_manager"
    worker = "worker"

class Species(str, Enum):
    vannamei = "Vannamei"
    black_tiger = "Black Tiger"
    sea_tiger = "Sea Tiger"

class FreshnessGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    rejected = "Rejected"

class PaymentStatus(str, Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"

class ProcessType(str, Enum):
    heading = "heading"
    peeling = "peeling"
    deveining = "deveining"
    iqf = "IQF"
    blanching = "blanching"
    grading = "grading"

class ProductForm(str, Enum):
    hoso = "HOSO"
    hlso = "HLSO"
    pto = "PTO"
    pd = "PD"
    pdto = "PDTO"
    butterfly = "Butterfly"
    ring_cut = "Ring Cut"
    cooked = "Cooked"

class QCStatus(str, Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    on_hold = "on_hold"

class StorageStatus(str, Enum):
    occupied = "occupied"
    empty = "empty"
    reserved = "reserved"
    maintenance = "maintenance"

class ShipmentStatus(str, Enum):
    draft = "draft"
    confirmed = "confirmed"
    in_transit = "in_transit"
    delivered = "delivered"

class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class PriceCategory(str, Enum):
    vannamei_30_40 = "Vannamei 30/40"
    vannamei_40_60 = "Vannamei 40/60"
    vannamei_60_80 = "Vannamei 60/80"
    black_tiger_20_30 = "Black Tiger 20/30"
    black_tiger_30_40 = "Black Tiger 30/40"

    cancelled = "cancelled"


# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_code: str
    name: str
    phone: str
    gst: Optional[str] = None
    pan: Optional[str] = None
    commission_pct: float = 0.0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AgentCreate(BaseModel):
    agent_code: str
    name: str
    phone: str
    gst: Optional[str] = None
    pan: Optional[str] = None
    commission_pct: float = 0.0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None

class ProcurementPayment(BaseModel):
    amount: float
    payment_mode: str
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reference: Optional[str] = None

class ProcurementLot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lot_number: str
    agent_id: str
    agent_name: str
    vehicle_number: str
    driver_name: str
    arrival_time: datetime
    species: Species
    count_per_kg: str
    boxes_count: int
    gross_weight_kg: float
    ice_weight_kg: float
    net_weight_kg: float
    no_of_tons: float
    no_of_trays: int = 0
    rate_per_kg: float
    total_amount: float
    advance_paid: float = 0.0
    balance_due: float
    ice_ratio_pct: Optional[float] = None
    freshness_grade: FreshnessGrade
    is_rejected: bool = False
    rejection_reason: Optional[str] = None
    payment_status: PaymentStatus = PaymentStatus.pending
    payments: List[ProcurementPayment] = []
    photos: List[str] = []
    is_update_pending_approval: bool = False
    approval_status: ApprovalStatus = ApprovalStatus.approved
    approval_notes: Optional[str] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    attachments: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class ProcurementLotCreate(BaseModel):
    agent_id: str
    vehicle_number: str
    driver_name: str
    arrival_time: datetime
    species: Species
    count_per_kg: str
    boxes_count: int
    no_of_trays: int = 0
    gross_weight_kg: float
    ice_weight_kg: float
    rate_per_kg: float
    advance_paid: float = 0.0
    ice_ratio_pct: Optional[float] = None
    freshness_grade: FreshnessGrade
    is_rejected: bool = False
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class Worker(BaseModel):
    worker_code: str
    name: str
    kg_processed: float
    hours_worked: float

class PreprocessingBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_number: str
    procurement_lot_id: str
    process_type: ProcessType
    input_weight_kg: float
    output_weight_kg: float
    waste_weight_kg: float
    yield_pct: float
    yield_alert: bool = False
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_mins: Optional[float] = None
    workers: List[Worker] = []
    supervisor: str
    notes: Optional[str] = None
    attachments: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PreprocessingBatchCreate(BaseModel):
    procurement_lot_id: str
    process_type: ProcessType
    input_weight_kg: float
    output_weight_kg: float
    no_of_trays: int = 0
    start_time: datetime
    end_time: Optional[datetime] = None
    workers: List[Worker] = []
    supervisor: str
    notes: Optional[str] = None

class ProductionOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    preprocessing_batch_ids: List[str]
    product_form: ProductForm
    target_size_count: str
    glazing_pct: Optional[float] = None
    block_weight_kg: Optional[float] = None
    no_of_blocks: int
    input_weight_kg: float
    output_weight_kg: float
    conversion_rate_pct: float
    qc_status: QCStatus = QCStatus.pending
    notes: Optional[str] = None
    attachments: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductionOrderCreate(BaseModel):
    preprocessing_batch_ids: List[str]
    product_form: ProductForm
    target_size_count: str
    glazing_pct: Optional[float] = None
    block_weight_kg: Optional[float] = None
    no_of_blocks: int
    input_weight_kg: float
    output_weight_kg: float
    notes: Optional[str] = None

class FinishedGood(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fg_code: str
    production_order_id: str
    product_form: ProductForm
    size_count: str
    weight_kg: float
    qc_status: QCStatus = QCStatus.pending
    storage_location: Optional[str] = None
    temperature_c: Optional[float] = None
    manufactured_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiry_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FinishedGoodCreate(BaseModel):
    production_order_id: str
    product_form: ProductForm
    size_count: str
    weight_kg: float
    storage_location: Optional[str] = None
    temperature_c: Optional[float] = None
    expiry_date: Optional[datetime] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    module: str
    target_roles: List[UserRole]
    is_read: bool = False
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationCreate(BaseModel):
    title: str
    message: str
    module: str
    target_roles: List[UserRole]

class DashboardStats(BaseModel):
    total_procurement_lots: int
    total_weight_procured_kg: float
    total_procurement_value: float
    active_preprocessing_batches: int
    active_production_orders: int
    finished_goods_inventory_kg: float
    pending_qc_items: int
    recent_activities: List[Dict[str, Any]]


# QC Module Models
class QCInspection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    inspection_code: str
    entity_type: str  # procurement_lot, finished_good, cold_storage_slot
    entity_id: str
    inspection_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    qc_officer: str
    parameters: Dict[str, Any] = {}  # Flexible JSONB-like field
    overall_grade: FreshnessGrade
    pass_fail: bool
    failure_reason: Optional[str] = None
    lab_report_ref: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QCInspectionCreate(BaseModel):
    entity_type: str
    entity_id: str
    qc_officer: str
    parameters: Dict[str, Any] = {}
    overall_grade: FreshnessGrade
    pass_fail: bool
    failure_reason: Optional[str] = None
    lab_report_ref: Optional[str] = None
    notes: Optional[str] = None

# Cold Storage Models
class ColdStorageChamber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chamber_code: str  # CH-01, CH-02
    chamber_name: str
    setpoint_temperature_c: float = -18.0
    capacity_kg: float
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ColdStorageChamberCreate(BaseModel):
    chamber_code: str
    chamber_name: str
    setpoint_temperature_c: float = -18.0
    capacity_kg: float

class ColdStorageSlot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slot_code: str  # CH-01-R01-S05
    chamber_id: str
    rack_number: int
    slot_number: int
    status: StorageStatus = StorageStatus.empty
    occupied_weight_kg: float = 0.0
    fg_id: Optional[str] = None  # Linked finished good
    intake_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ColdStorageSlotCreate(BaseModel):
    slot_code: str
    chamber_id: str
    rack_number: int
    slot_number: int

class ColdStorageInventory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slot_id: str
    fg_id: str
    quantity_kg: float
    carton_count: int
    intake_date: datetime
    days_in_storage: int = 0
    fifo_alert: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ColdStorageInventoryCreate(BaseModel):
    slot_id: str
    fg_id: str
    quantity_kg: float
    carton_count: int

class TemperatureLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chamber_id: str
    temperature_c: float
    alert: bool = False
    alert_reason: Optional[str] = None
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemperatureLogCreate(BaseModel):
    chamber_id: str
    temperature_c: float

# Sales & Dispatch Models
class Buyer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    buyer_code: str
    company_name: str
    country: str
    ie_code: Optional[str] = None
    gst: Optional[str] = None
    contact_person: str
    phone: str
    email: EmailStr
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BuyerCreate(BaseModel):
    buyer_code: str
    company_name: str
    country: str
    ie_code: Optional[str] = None
    gst: Optional[str] = None
    contact_person: str
    phone: str
    email: EmailStr

class SalesOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    buyer_id: str
    buyer_name: str
    quantity_kg: float
    rate_per_kg_usd: float
    currency: str = "USD"
    total_value_usd: float
    delivery_date: datetime
    payment_status: PaymentStatus = PaymentStatus.pending
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SalesOrderCreate(BaseModel):
    buyer_id: str
    quantity_kg: float
    rate_per_kg_usd: float
    currency: str = "USD"
    delivery_date: datetime
    notes: Optional[str] = None

class Shipment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_number: str
    sales_order_id: str
    container_no: str
    seal_no: str
    shipping_line: str
    vessel_name: str
    port_of_loading: str
    port_of_discharge: str
    destination_country: str
    etd: datetime  # Estimated Time of Departure
    eta: datetime  # Estimated Time of Arrival
    bill_of_lading: Optional[str] = None
    shipment_status: ShipmentStatus = ShipmentStatus.draft
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShipmentCreate(BaseModel):
    sales_order_id: str
    container_no: str
    seal_no: str
    shipping_line: str
    vessel_name: str
    port_of_loading: str
    port_of_discharge: str
    destination_country: str
    etd: datetime
    eta: datetime
    bill_of_lading: Optional[str] = None

# Wage & Billing Models
class WageBill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_number: str
    bill_type: str  # VA, TDS, contractor, daily
    period_from: datetime
    period_to: datetime
    department: str
    gross_amount: float
    tds_deduction: float
    net_payable: float
    payment_status: PaymentStatus = PaymentStatus.pending
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WageBillCreate(BaseModel):
    bill_type: str
    period_from: datetime
    period_to: datetime
    department: str
    gross_amount: float
    tds_deduction: float
    notes: Optional[str] = None

class WageBillLine(BaseModel):
    worker_code: str
    worker_name: str
    days_worked: float
    rate_per_day: float
    basic_amount: float
    va_allowance: float
    tds_deducted: float
    net_amount: float

class Attachment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str
    entity_id: str
    file_name: str
    file_url: str
    file_size_kb: float
    mime_type: str
    category: str  # invoice, weighment_slip, lab_report, gate_pass, photo, other
    description: Optional[str] = None
    uploaded_by: str
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttachmentCreate(BaseModel):
    entity_type: str
    entity_id: str
    file_name: str
    category: str
    description: Optional[str] = None

class Note(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str
    entity_id: str
    note_text: str
    is_pinned: bool = False
    is_admin_note: bool = False
    authored_by: str
    author_name: str
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoteCreate(BaseModel):
    entity_type: str
    entity_id: str
    note_text: str
    is_pinned: bool = False


# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# Approval Workflow Models
class PendingApproval(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str  # procurement_lot, production_order, etc
    entity_id: str
    entity_display: str  # Lot number, order number, etc
    change_type: str  # update, delete, status_change
    old_data: Dict[str, Any] = {}
    new_data: Dict[str, Any] = {}
    requested_by: str
    requester_name: str
    approval_status: ApprovalStatus = ApprovalStatus.pending
    approved_by: Optional[str] = None
    approval_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApprovalAction(BaseModel):
    approval_id: str
    action: str  # approve, reject
    notes: Optional[str] = None

# Live Price Tracking Models
class LivePriceData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # Vannamei 30/40, etc
    price_per_kg: float
    location: str = "Andhra Pradesh"
    market: str  # Nellore, Kakinada, etc
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "Market Data"

class PhotoTracker(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str
    entity_id: str
    entity_display: str
    stage: str  # procurement, preprocessing, production, qc, cold_storage
    photo_url: str
    count_per_kg_visible: Optional[str] = None
    tray_count_visible: Optional[int] = None
    uploaded_by: str
    uploader_name: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PhotoUpload(BaseModel):
    entity_type: str
    entity_id: str
    entity_display: str
    stage: str
    photo_url: str
    count_per_kg_visible: Optional[str] = None
    tray_count_visible: Optional[int] = None
    notes: Optional[str] = None

# Traceability Models
class TraceabilityRecord(BaseModel):
    lot_number: str
    procurement_data: Optional[Dict[str, Any]] = None
    preprocessing_data: List[Dict[str, Any]] = []
    production_data: List[Dict[str, Any]] = []
    finished_goods_data: List[Dict[str, Any]] = []
    cold_storage_data: List[Dict[str, Any]] = []
    shipment_data: Optional[Dict[str, Any]] = None
    total_count_per_kg_changes: List[str] = []
    total_tray_count: int = 0
    photos_count: int = 0


# ============================================================================
# WASTAGE TRACKING MODELS (v4.0)
# ============================================================================

class YieldBenchmark(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    species: Species
    process_type: str  # 'gate_ice', 'heading', 'peeling', 'deveining', etc.
    min_yield_pct: Optional[float] = None
    optimal_yield_pct: Optional[float] = None
    max_yield_pct: Optional[float] = None
    tolerance_pct: Optional[float] = None  # For glazing/breading
    reference_rate_per_kg: Optional[float] = None
    description: Optional[str] = None
    is_active: bool = True
    set_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class YieldBenchmarkCreate(BaseModel):
    species: Species
    process_type: str
    min_yield_pct: Optional[float] = None
    optimal_yield_pct: Optional[float] = None
    max_yield_pct: Optional[float] = None
    tolerance_pct: Optional[float] = None
    reference_rate_per_kg: Optional[float] = None
    description: Optional[str] = None

class MarketRate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    species: Species
    product_form: Optional[str] = None  # NULL = raw/unprocessed
    size_value: Optional[str] = None  # NULL = all sizes
    rate_per_kg_inr: float
    rate_per_kg_usd: Optional[float] = None
    effective_from: date
    effective_to: Optional[date] = None  # NULL = currently active
    remarks: Optional[str] = None
    set_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MarketRateCreate(BaseModel):
    species: Species
    product_form: Optional[str] = None
    size_value: Optional[str] = None
    rate_per_kg_inr: float
    rate_per_kg_usd: Optional[float] = None
    effective_from: date
    effective_to: Optional[date] = None
    remarks: Optional[str] = None

class LotStageWastage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lot_id: str
    stage_sequence: int
    stage_name: str
    process_type: str
    source_entity_type: Optional[str] = None
    source_entity_id: Optional[str] = None
    input_weight_kg: float
    output_weight_kg: float
    wastage_kg: float = 0  # Calculated: input - output
    yield_pct: float = 0  # Calculated: (output / input) * 100
    min_yield_pct: Optional[float] = None
    optimal_yield_pct: Optional[float] = None
    threshold_status: str = "info"  # green | amber | red | info
    rate_per_kg_used: Optional[float] = None
    revenue_loss_inr: float = 0
    gradedown_kg: float = 0
    gradedown_rate_gap: float = 0
    gradedown_loss_inr: float = 0
    target_glaze_pct: Optional[float] = None
    actual_glaze_pct: Optional[float] = None
    glaze_variance_pct: Optional[float] = None
    glaze_revenue_gap_inr: float = 0
    byproduct_revenue_inr: float = 0
    net_loss_inr: float = 0
    is_alert: bool = False
    alert_acknowledged: bool = False
    alert_ack_by: Optional[str] = None
    alert_ack_at: Optional[datetime] = None
    recorded_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class LotStageWastageCreate(BaseModel):
    lot_id: str
    stage_sequence: int
    stage_name: str
    process_type: str
    source_entity_type: Optional[str] = None
    source_entity_id: Optional[str] = None
    input_weight_kg: float
    output_weight_kg: float

class WastageDashboardStats(BaseModel):
    today_wastage_kg: float = 0
    today_lots_count: int = 0
    month_revenue_loss_inr: float = 0
    month_lots_count: int = 0
    active_red_alerts: int = 0
    byproduct_revenue_inr: float = 0

class WastageBreachAlert(BaseModel):
    id: str
    lot_id: str
    lot_number: str
    stage_name: str
    species: str
    actual_yield_pct: float
    min_threshold_pct: float
    variance_pct: float
    loss_inr: float
    created_at: datetime


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

def generate_lot_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    counter = now.strftime("%H%M%S")
    return f"PRW-{date_str}-{counter}"

def generate_batch_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"BATCH-{date_str}-{counter}"


# ============================================================================
# WASTAGE TRACKING HELPER FUNCTIONS
# ============================================================================

async def create_wastage_record(
    lot_id: str,
    stage_sequence: int,
    stage_name: str,
    process_type: str,
    input_weight_kg: float,
    output_weight_kg: float,
    source_entity_type: str,
    source_entity_id: str,
    recorded_by: str
) -> dict:
    """
    Create a wastage record and return it
    Auto-calculates yield, checks thresholds, creates alerts if needed
    """
    # Calculate derived fields
    wastage_kg = input_weight_kg - output_weight_kg
    yield_pct = (output_weight_kg / input_weight_kg * 100) if input_weight_kg > 0 else 0
    
    # Look up lot and benchmark
    lot = await db.procurement_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        return None
    
    benchmark = await db.yield_benchmarks.find_one({
        "species": lot['species'],
        "process_type": process_type,
        "is_active": True
    }, {"_id": 0})
    
    # Calculate threshold status
    threshold_status = "info"
    min_yield_pct = None
    optimal_yield_pct = None
    
    if benchmark:
        min_yield_pct = benchmark.get('min_yield_pct')
        optimal_yield_pct = benchmark.get('optimal_yield_pct')
        
        if min_yield_pct and optimal_yield_pct:
            if yield_pct >= optimal_yield_pct:
                threshold_status = "green"
            elif yield_pct >= min_yield_pct:
                threshold_status = "amber"
            else:
                threshold_status = "red"
    
    # Look up market rate
    rate_per_kg = None
    if benchmark and benchmark.get('reference_rate_per_kg'):
        rate_per_kg = benchmark['reference_rate_per_kg']
    else:
        rate_per_kg = lot.get('rate_per_kg', 0)
    
    # Calculate revenue loss
    revenue_loss_inr = wastage_kg * rate_per_kg if rate_per_kg else 0
    
    # Create wastage record
    wastage = {
        "id": str(uuid.uuid4()),
        "lot_id": lot_id,
        "stage_sequence": stage_sequence,
        "stage_name": stage_name,
        "process_type": process_type,
        "source_entity_type": source_entity_type,
        "source_entity_id": source_entity_id,
        "input_weight_kg": input_weight_kg,
        "output_weight_kg": output_weight_kg,
        "wastage_kg": wastage_kg,
        "yield_pct": round(yield_pct, 2),
        "min_yield_pct": min_yield_pct,
        "optimal_yield_pct": optimal_yield_pct,
        "threshold_status": threshold_status,
        "rate_per_kg_used": rate_per_kg,
        "revenue_loss_inr": revenue_loss_inr,
        "gradedown_kg": 0,
        "gradedown_rate_gap": 0,
        "gradedown_loss_inr": 0,
        "target_glaze_pct": None,
        "actual_glaze_pct": None,
        "glaze_variance_pct": None,
        "glaze_revenue_gap_inr": 0,
        "byproduct_revenue_inr": 0,
        "net_loss_inr": revenue_loss_inr,
        "is_alert": (threshold_status == "red"),
        "alert_acknowledged": False,
        "alert_ack_by": None,
        "alert_ack_at": None,
        "recorded_by": recorded_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.lot_stage_wastage.insert_one(wastage)
    
    # Create alert notification if red
    if wastage["is_alert"]:
        notification = {
            "id": str(uuid.uuid4()),
            "title": f"🔴 Yield Alert: {stage_name} below minimum threshold",
            "message": f"Lot {lot['lot_number']} {stage_name}: {yield_pct:.2f}% yield (min: {min_yield_pct}%)\nWastage: {wastage_kg:.2f} kg | Revenue loss: ₹{revenue_loss_inr:.2f}",
            "type": "alert",
            "priority": "urgent",
            "target_roles": ['admin', 'owner', 'production_supervisor'],
            "link": f"/lot/{lot_id}/wastage",
            "is_read": False,
            "created_by": recorded_by,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return wastage


    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"BATCH-{date_str}-{counter}"

def generate_order_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"PO-{date_str}-{counter}"

def generate_fg_code() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"FG-{date_str}-{counter}"

async def create_audit_log(user_id: str, action: str, module: str, details: dict):
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "module": module,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log)


def generate_inspection_code() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"QC-{date_str}-{counter}"

def generate_order_num() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"SO-{date_str}-{counter}"

def generate_shipment_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"SHIP-{date_str}-{counter}"

def generate_bill_number() -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    counter = now.strftime("%H%M%S")
    return f"BILL-{date_str}-{counter}"


def generate_procurement_receipt_pdf(lot: ProcurementLot, agent: Agent) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    elements.append(Paragraph("PROCUREMENT RECEIPT", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    info_data = [
        ['Lot Number:', lot.lot_number, 'Date:', lot.arrival_time.strftime('%d-%m-%Y %H:%M')],
        ['Agent:', agent.name, 'Agent Code:', agent.agent_code],
        ['Vehicle:', lot.vehicle_number, 'Driver:', lot.driver_name],
        ['Species:', lot.species.value, 'Count/KG:', lot.count_per_kg],
    ]
    
    info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#374151')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    weight_data = [
        ['Description', 'Value'],
        ['Boxes/Crates', str(lot.boxes_count)],
        ['Gross Weight (KG)', f"{lot.gross_weight_kg:.2f}"],
        ['Ice Weight (KG)', f"{lot.ice_weight_kg:.2f}"],
        ['Net Weight (KG)', f"{lot.net_weight_kg:.2f}"],
        ['Tons', f"{lot.no_of_tons:.3f}"],
        ['Freshness Grade', lot.freshness_grade.value],
    ]
    
    weight_table = Table(weight_data, colWidths=[3*inch, 3*inch])
    weight_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(weight_table)
    elements.append(Spacer(1, 0.3*inch))
    
    payment_data = [
        ['Payment Details', ''],
        ['Rate per KG', f"₹{lot.rate_per_kg:.2f}"],
        ['Total Amount', f"₹{lot.total_amount:.2f}"],
        ['Advance Paid', f"₹{lot.advance_paid:.2f}"],
        ['Balance Due', f"₹{lot.balance_due:.2f}"],
        ['Payment Status', lot.payment_status.value.upper()],
    ]
    
    payment_table = Table(payment_data, colWidths=[3*inch, 3*inch])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(payment_table)
    
    if lot.notes:
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph(f"<b>Notes:</b> {lot.notes}", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hashed_password
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    access_token = create_access_token(data={"sub": user.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Agents endpoints
@api_router.post("/agents", response_model=Agent)
async def create_agent(agent_data: AgentCreate, current_user: User = Depends(get_current_user)):
    agent = Agent(**agent_data.model_dump())
    agent_dict = agent.model_dump()
    agent_dict['created_at'] = agent_dict['created_at'].isoformat()
    
    await db.agents.insert_one(agent_dict)
    await create_audit_log(current_user.id, "CREATE_AGENT", "procurement", {"agent_id": agent.id})
    return agent

@api_router.get("/agents", response_model=List[Agent])
async def get_agents(current_user: User = Depends(get_current_user)):
    agents = await db.agents.find({}, {"_id": 0}).to_list(1000)
    for agent in agents:
        if isinstance(agent.get('created_at'), str):
            agent['created_at'] = datetime.fromisoformat(agent['created_at'])
    return agents

@api_router.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, current_user: User = Depends(get_current_user)):
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if isinstance(agent.get('created_at'), str):
        agent['created_at'] = datetime.fromisoformat(agent['created_at'])
    return Agent(**agent)

# Procurement endpoints
@api_router.post("/procurement/lots", response_model=ProcurementLot)
async def create_procurement_lot(lot_data: ProcurementLotCreate, current_user: User = Depends(get_current_user)):
    agent = await db.agents.find_one({"id": lot_data.agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    net_weight = lot_data.gross_weight_kg - lot_data.ice_weight_kg
    total_amount = net_weight * lot_data.rate_per_kg
    balance = total_amount - lot_data.advance_paid
    
    payment_status = PaymentStatus.paid if balance <= 0 else (PaymentStatus.partial if lot_data.advance_paid > 0 else PaymentStatus.pending)
    
    lot = ProcurementLot(
        lot_number=generate_lot_number(),
        agent_id=lot_data.agent_id,
        agent_name=agent['name'],
        vehicle_number=lot_data.vehicle_number,
        driver_name=lot_data.driver_name,
        arrival_time=lot_data.arrival_time,
        species=lot_data.species,
        count_per_kg=lot_data.count_per_kg,
        boxes_count=lot_data.boxes_count,
        no_of_trays=lot_data.no_of_trays,
        gross_weight_kg=lot_data.gross_weight_kg,
        ice_weight_kg=lot_data.ice_weight_kg,
        net_weight_kg=net_weight,
        no_of_tons=net_weight / 1000,
        rate_per_kg=lot_data.rate_per_kg,
        total_amount=total_amount,
        advance_paid=lot_data.advance_paid,
        balance_due=balance,
        ice_ratio_pct=lot_data.ice_ratio_pct,
        freshness_grade=lot_data.freshness_grade,
        is_rejected=lot_data.is_rejected,
        rejection_reason=lot_data.rejection_reason,
        payment_status=payment_status,
        notes=lot_data.notes,
        created_by=current_user.id
    )
    
    lot_dict = lot.model_dump()
    lot_dict['created_at'] = lot_dict['created_at'].isoformat()
    lot_dict['arrival_time'] = lot_dict['arrival_time'].isoformat()
    
    await db.procurement_lots.insert_one(lot_dict)
    await create_audit_log(current_user.id, "CREATE_LOT", "procurement", {"lot_id": lot.id})
    
    # Auto-create gate_ice wastage record
    if lot.gross_weight_kg > 0:
        await create_wastage_record(
            lot_id=lot.id,
            stage_sequence=0,
            stage_name="Gate Ice Deduction",
            process_type="gate_ice",
            input_weight_kg=lot.gross_weight_kg,
            output_weight_kg=lot.net_weight_kg,
            source_entity_type="procurement_lot",
            source_entity_id=lot.id,
            recorded_by=current_user.id
        )
    
    return lot

@api_router.get("/procurement/lots", response_model=List[ProcurementLot])
async def get_procurement_lots(current_user: User = Depends(get_current_user)):
    lots = await db.procurement_lots.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lot in lots:
        if isinstance(lot.get('created_at'), str):
            lot['created_at'] = datetime.fromisoformat(lot['created_at'])
        if isinstance(lot.get('arrival_time'), str):
            lot['arrival_time'] = datetime.fromisoformat(lot['arrival_time'])
        for payment in lot.get('payments', []):
            if isinstance(payment.get('payment_date'), str):
                payment['payment_date'] = datetime.fromisoformat(payment['payment_date'])
    return lots

@api_router.get("/procurement/lots/{lot_id}", response_model=ProcurementLot)
async def get_procurement_lot(lot_id: str, current_user: User = Depends(get_current_user)):
    lot = await db.procurement_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if isinstance(lot.get('created_at'), str):
        lot['created_at'] = datetime.fromisoformat(lot['created_at'])
    if isinstance(lot.get('arrival_time'), str):
        lot['arrival_time'] = datetime.fromisoformat(lot['arrival_time'])
    return ProcurementLot(**lot)

@api_router.get("/procurement/lots/{lot_id}/receipt")
async def download_receipt(lot_id: str, current_user: User = Depends(get_current_user)):
    lot = await db.procurement_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    if isinstance(lot.get('created_at'), str):
        lot['created_at'] = datetime.fromisoformat(lot['created_at'])
    if isinstance(lot.get('arrival_time'), str):
        lot['arrival_time'] = datetime.fromisoformat(lot['arrival_time'])
    
    agent = await db.agents.find_one({"id": lot['agent_id']}, {"_id": 0})
    if isinstance(agent.get('created_at'), str):
        agent['created_at'] = datetime.fromisoformat(agent['created_at'])
    
    lot_obj = ProcurementLot(**lot)
    agent_obj = Agent(**agent)
    
    pdf_bytes = generate_procurement_receipt_pdf(lot_obj, agent_obj)
    
    pdf_path = UPLOADS_DIR / f"receipt_{lot_id}.pdf"
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
    
    return FileResponse(
        path=pdf_path,
        media_type='application/pdf',
        filename=f"receipt_{lot_obj.lot_number}.pdf"
    )

# Preprocessing endpoints
@api_router.post("/preprocessing/batches", response_model=PreprocessingBatch)
async def create_preprocessing_batch(batch_data: PreprocessingBatchCreate, current_user: User = Depends(get_current_user)):
    waste_weight = batch_data.input_weight_kg - batch_data.output_weight_kg
    yield_pct = (batch_data.output_weight_kg / batch_data.input_weight_kg) * 100
    yield_alert = yield_pct < 75.0
    
    duration_mins = None
    if batch_data.end_time:
        duration = batch_data.end_time - batch_data.start_time
        duration_mins = duration.total_seconds() / 60
    
    batch = PreprocessingBatch(
        batch_number=generate_batch_number(),
        procurement_lot_id=batch_data.procurement_lot_id,
        process_type=batch_data.process_type,
        input_weight_kg=batch_data.input_weight_kg,
        output_weight_kg=batch_data.output_weight_kg,
        waste_weight_kg=waste_weight,
        yield_pct=yield_pct,
        yield_alert=yield_alert,
        start_time=batch_data.start_time,
        end_time=batch_data.end_time,
        duration_mins=duration_mins,
        workers=batch_data.workers,
        supervisor=batch_data.supervisor,
        notes=batch_data.notes,
        created_by=current_user.id
    )
    
    batch_dict = batch.model_dump()
    batch_dict['created_at'] = batch_dict['created_at'].isoformat()
    batch_dict['start_time'] = batch_dict['start_time'].isoformat()
    if batch_dict.get('end_time'):
        batch_dict['end_time'] = batch_dict['end_time'].isoformat()
    
    await db.preprocessing_batches.insert_one(batch_dict)
    await create_audit_log(current_user.id, "CREATE_BATCH", "preprocessing", {"batch_id": batch.id})
    
    # Auto-create wastage record for this preprocessing stage
    stage_sequence_map = {"heading": 1, "peeling": 2, "deveining": 3, "grading": 4}
    stage_sequence = stage_sequence_map.get(batch.process_type, 5)
    
    await create_wastage_record(
        lot_id=batch.procurement_lot_id,
        stage_sequence=stage_sequence,
        stage_name=batch.process_type.capitalize(),
        process_type=batch.process_type,
        input_weight_kg=batch.input_weight_kg,
        output_weight_kg=batch.output_weight_kg,
        source_entity_type="preprocessing_batch",
        source_entity_id=batch.id,
        recorded_by=current_user.id
    )
    
    return batch

@api_router.get("/preprocessing/batches", response_model=List[PreprocessingBatch])
async def get_preprocessing_batches(current_user: User = Depends(get_current_user)):
    batches = await db.preprocessing_batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for batch in batches:
        if isinstance(batch.get('created_at'), str):
            batch['created_at'] = datetime.fromisoformat(batch['created_at'])
        if isinstance(batch.get('start_time'), str):
            batch['start_time'] = datetime.fromisoformat(batch['start_time'])
        if batch.get('end_time') and isinstance(batch['end_time'], str):
            batch['end_time'] = datetime.fromisoformat(batch['end_time'])
    return batches

# Production endpoints
@api_router.post("/production/orders", response_model=ProductionOrder)
async def create_production_order(order_data: ProductionOrderCreate, current_user: User = Depends(get_current_user)):
    conversion_rate = (order_data.output_weight_kg / order_data.input_weight_kg) * 100
    
    order = ProductionOrder(
        order_number=generate_order_number(),
        preprocessing_batch_ids=order_data.preprocessing_batch_ids,
        product_form=order_data.product_form,
        target_size_count=order_data.target_size_count,
        glazing_pct=order_data.glazing_pct,
        block_weight_kg=order_data.block_weight_kg,
        no_of_blocks=order_data.no_of_blocks,
        input_weight_kg=order_data.input_weight_kg,
        output_weight_kg=order_data.output_weight_kg,
        conversion_rate_pct=conversion_rate,
        notes=order_data.notes,
        created_by=current_user.id
    )
    
    order_dict = order.model_dump()
    order_dict['created_at'] = order_dict['created_at'].isoformat()
    
    await db.production_orders.insert_one(order_dict)
    await create_audit_log(current_user.id, "CREATE_PRODUCTION_ORDER", "production", {"order_id": order.id})
    
    # Auto-create wastage record for production stage
    # Get the preprocessing batch to find the lot_id
    batch = await db.preprocessing_batches.find_one({"id": order.preprocessing_batch_id}, {"_id": 0})
    if batch:
        lot_id = batch.get("procurement_lot_id")
        
        # Determine stage sequence based on process_type
        stage_sequence_map = {"cooking": 5, "blanching": 5, "iqf_freezing": 6, "glazing": 7, "breading": 8}
        stage_sequence = stage_sequence_map.get(order.process_type, 9)
        
        await create_wastage_record(
            lot_id=lot_id,
            stage_sequence=stage_sequence,
            stage_name=order.process_type.capitalize(),
            process_type=order.process_type,
            input_weight_kg=order.input_weight_kg,
            output_weight_kg=order.output_weight_kg,
            source_entity_type="production_order",
            source_entity_id=order.id,
            recorded_by=current_user.id
        )
    
    return order

@api_router.get("/production/orders", response_model=List[ProductionOrder])
async def get_production_orders(current_user: User = Depends(get_current_user)):
    orders = await db.production_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    return orders

# Finished Goods endpoints
@api_router.post("/finished-goods", response_model=FinishedGood)
async def create_finished_good(fg_data: FinishedGoodCreate, current_user: User = Depends(get_current_user)):
    fg = FinishedGood(
        fg_code=generate_fg_code(),
        production_order_id=fg_data.production_order_id,
        product_form=fg_data.product_form,
        size_count=fg_data.size_count,
        weight_kg=fg_data.weight_kg,
        storage_location=fg_data.storage_location,
        temperature_c=fg_data.temperature_c,
        expiry_date=fg_data.expiry_date
    )
    
    fg_dict = fg.model_dump()
    fg_dict['created_at'] = fg_dict['created_at'].isoformat()
    fg_dict['manufactured_date'] = fg_dict['manufactured_date'].isoformat()
    if fg_dict.get('expiry_date'):
        fg_dict['expiry_date'] = fg_dict['expiry_date'].isoformat()
    
    await db.finished_goods.insert_one(fg_dict)
    await create_audit_log(current_user.id, "CREATE_FINISHED_GOOD", "production", {"fg_id": fg.id})
    return fg

@api_router.get("/finished-goods", response_model=List[FinishedGood])
async def get_finished_goods(current_user: User = Depends(get_current_user)):
    fgs = await db.finished_goods.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for fg in fgs:
        if isinstance(fg.get('created_at'), str):
            fg['created_at'] = datetime.fromisoformat(fg['created_at'])
        if isinstance(fg.get('manufactured_date'), str):
            fg['manufactured_date'] = datetime.fromisoformat(fg['manufactured_date'])
        if fg.get('expiry_date') and isinstance(fg['expiry_date'], str):
            fg['expiry_date'] = datetime.fromisoformat(fg['expiry_date'])
    return fgs

# Notifications
@api_router.post("/notifications", response_model=Notification)
async def create_notification(notif_data: NotificationCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.owner]:
        raise HTTPException(status_code=403, detail="Only admins can create notifications")
    
    notif = Notification(
        title=notif_data.title,
        message=notif_data.message,
        module=notif_data.module,
        target_roles=notif_data.target_roles,
        created_by=current_user.id
    )
    
    notif_dict = notif.model_dump()
    notif_dict['created_at'] = notif_dict['created_at'].isoformat()
    
    await db.notifications.insert_one(notif_dict)
    return notif

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"target_roles": current_user.role.value},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for notif in notifs:
        if isinstance(notif.get('created_at'), str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    return notifs

# Dashboard
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    lots = await db.procurement_lots.find({}, {"_id": 0}).to_list(10000)
    batches = await db.preprocessing_batches.find({"end_time": None}, {"_id": 0}).to_list(1000)
    orders = await db.production_orders.find({"qc_status": "pending"}, {"_id": 0}).to_list(1000)
    fgs = await db.finished_goods.find({}, {"_id": 0}).to_list(10000)
    pending_qc = await db.finished_goods.find({"qc_status": "pending"}, {"_id": 0}).to_list(1000)
    
    total_weight = sum(lot.get('net_weight_kg', 0) for lot in lots)
    total_value = sum(lot.get('total_amount', 0) for lot in lots)
    fg_inventory = sum(fg.get('weight_kg', 0) for fg in fgs)
    
    recent_lots = await db.procurement_lots.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_activities = [
        {
            "type": "procurement",
            "description": f"New lot {lot.get('lot_number')} - {lot.get('net_weight_kg'):.2f} KG",
            "timestamp": lot.get('created_at')
        }
        for lot in recent_lots
    ]
    
    return DashboardStats(
        total_procurement_lots=len(lots),
        total_weight_procured_kg=total_weight,
        total_procurement_value=total_value,
        active_preprocessing_batches=len(batches),
        active_production_orders=len(orders),
        finished_goods_inventory_kg=fg_inventory,
        pending_qc_items=len(pending_qc),
        recent_activities=recent_activities
    )



# QC Module endpoints
@api_router.post("/qc/inspections", response_model=QCInspection)
async def create_qc_inspection(inspection_data: QCInspectionCreate, current_user: User = Depends(get_current_user)):
    inspection = QCInspection(
        inspection_code=generate_inspection_code(),
        entity_type=inspection_data.entity_type,
        entity_id=inspection_data.entity_id,
        qc_officer=inspection_data.qc_officer,
        parameters=inspection_data.parameters,
        overall_grade=inspection_data.overall_grade,
        pass_fail=inspection_data.pass_fail,
        failure_reason=inspection_data.failure_reason,
        lab_report_ref=inspection_data.lab_report_ref,
        notes=inspection_data.notes,
        created_by=current_user.id
    )
    
    inspection_dict = inspection.model_dump()
    inspection_dict['created_at'] = inspection_dict['created_at'].isoformat()
    inspection_dict['inspection_date'] = inspection_dict['inspection_date'].isoformat()
    
    await db.qc_inspections.insert_one(inspection_dict)
    await create_audit_log(current_user.id, "CREATE_QC_INSPECTION", "qc", {"inspection_id": inspection.id})
    return inspection

@api_router.get("/qc/inspections", response_model=List[QCInspection])
async def get_qc_inspections(current_user: User = Depends(get_current_user)):
    inspections = await db.qc_inspections.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for insp in inspections:
        if isinstance(insp.get('created_at'), str):
            insp['created_at'] = datetime.fromisoformat(insp['created_at'])
        if isinstance(insp.get('inspection_date'), str):
            insp['inspection_date'] = datetime.fromisoformat(insp['inspection_date'])
    return inspections

# Cold Storage endpoints
@api_router.post("/cold-storage/chambers", response_model=ColdStorageChamber)
async def create_chamber(chamber_data: ColdStorageChamberCreate, current_user: User = Depends(get_current_user)):
    chamber = ColdStorageChamber(**chamber_data.model_dump())
    chamber_dict = chamber.model_dump()
    chamber_dict['created_at'] = chamber_dict['created_at'].isoformat()
    
    await db.cold_storage_chambers.insert_one(chamber_dict)
    await create_audit_log(current_user.id, "CREATE_CHAMBER", "cold_storage", {"chamber_id": chamber.id})
    return chamber

@api_router.get("/cold-storage/chambers", response_model=List[ColdStorageChamber])
async def get_chambers(current_user: User = Depends(get_current_user)):
    chambers = await db.cold_storage_chambers.find({}, {"_id": 0}).to_list(1000)
    for chamber in chambers:
        if isinstance(chamber.get('created_at'), str):
            chamber['created_at'] = datetime.fromisoformat(chamber['created_at'])
    return chambers

@api_router.post("/cold-storage/slots", response_model=ColdStorageSlot)
async def create_slot(slot_data: ColdStorageSlotCreate, current_user: User = Depends(get_current_user)):
    slot = ColdStorageSlot(**slot_data.model_dump())
    slot_dict = slot.model_dump()
    slot_dict['created_at'] = slot_dict['created_at'].isoformat()
    if slot_dict.get('intake_date'):
        slot_dict['intake_date'] = slot_dict['intake_date'].isoformat()
    
    await db.cold_storage_slots.insert_one(slot_dict)
    return slot

@api_router.get("/cold-storage/slots", response_model=List[ColdStorageSlot])
async def get_slots(current_user: User = Depends(get_current_user)):
    slots = await db.cold_storage_slots.find({}, {"_id": 0}).to_list(1000)
    for slot in slots:
        if isinstance(slot.get('created_at'), str):
            slot['created_at'] = datetime.fromisoformat(slot['created_at'])
        if slot.get('intake_date') and isinstance(slot['intake_date'], str):
            slot['intake_date'] = datetime.fromisoformat(slot['intake_date'])
    return slots

@api_router.post("/cold-storage/inventory", response_model=ColdStorageInventory)
async def add_to_inventory(inventory_data: ColdStorageInventoryCreate, current_user: User = Depends(get_current_user)):
    intake_date = datetime.now(timezone.utc)
    days_in_storage = 0
    
    inventory = ColdStorageInventory(
        slot_id=inventory_data.slot_id,
        fg_id=inventory_data.fg_id,
        quantity_kg=inventory_data.quantity_kg,
        carton_count=inventory_data.carton_count,
        intake_date=intake_date,
        days_in_storage=days_in_storage
    )
    
    inventory_dict = inventory.model_dump()
    inventory_dict['created_at'] = inventory_dict['created_at'].isoformat()
    inventory_dict['intake_date'] = inventory_dict['intake_date'].isoformat()
    
    await db.cold_storage_inventory.insert_one(inventory_dict)
    
    # Update slot status
    await db.cold_storage_slots.update_one(
        {"id": inventory_data.slot_id},
        {"$set": {
            "status": "occupied",
            "occupied_weight_kg": inventory_data.quantity_kg,
            "fg_id": inventory_data.fg_id,
            "intake_date": intake_date.isoformat()
        }}
    )
    
    return inventory

@api_router.get("/cold-storage/inventory", response_model=List[ColdStorageInventory])
async def get_inventory(current_user: User = Depends(get_current_user)):
    inventory = await db.cold_storage_inventory.find({}, {"_id": 0}).to_list(1000)
    for item in inventory:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('intake_date'), str):
            item['intake_date'] = datetime.fromisoformat(item['intake_date'])
        # Calculate days in storage
        if item.get('intake_date'):
            days = (datetime.now(timezone.utc) - item['intake_date']).days
            item['days_in_storage'] = days
    return inventory

@api_router.post("/cold-storage/temperature-logs", response_model=TemperatureLog)
async def log_temperature(log_data: TemperatureLogCreate, current_user: User = Depends(get_current_user)):
    chamber = await db.cold_storage_chambers.find_one({"id": log_data.chamber_id}, {"_id": 0})
    if not chamber:
        raise HTTPException(status_code=404, detail="Chamber not found")
    
    setpoint = chamber.get('setpoint_temperature_c', -18.0)
    temp_diff = abs(log_data.temperature_c - setpoint)
    alert = temp_diff > 2.0
    alert_reason = f"Temperature deviation: {temp_diff:.1f}°C from setpoint" if alert else None
    
    temp_log = TemperatureLog(
        chamber_id=log_data.chamber_id,
        temperature_c=log_data.temperature_c,
        alert=alert,
        alert_reason=alert_reason
    )
    
    temp_log_dict = temp_log.model_dump()
    temp_log_dict['recorded_at'] = temp_log_dict['recorded_at'].isoformat()
    
    await db.temperature_logs.insert_one(temp_log_dict)
    return temp_log

@api_router.get("/cold-storage/temperature-logs", response_model=List[TemperatureLog])
async def get_temperature_logs(chamber_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"chamber_id": chamber_id} if chamber_id else {}
    logs = await db.temperature_logs.find(query, {"_id": 0}).sort("recorded_at", -1).limit(100).to_list(100)
    for log in logs:
        if isinstance(log.get('recorded_at'), str):
            log['recorded_at'] = datetime.fromisoformat(log['recorded_at'])
    return logs

# Sales & Dispatch endpoints
@api_router.post("/buyers", response_model=Buyer)
async def create_buyer(buyer_data: BuyerCreate, current_user: User = Depends(get_current_user)):
    buyer = Buyer(**buyer_data.model_dump())
    buyer_dict = buyer.model_dump()
    buyer_dict['created_at'] = buyer_dict['created_at'].isoformat()
    
    await db.buyers.insert_one(buyer_dict)
    await create_audit_log(current_user.id, "CREATE_BUYER", "sales", {"buyer_id": buyer.id})
    return buyer

@api_router.get("/buyers", response_model=List[Buyer])
async def get_buyers(current_user: User = Depends(get_current_user)):
    buyers = await db.buyers.find({}, {"_id": 0}).to_list(1000)
    for buyer in buyers:
        if isinstance(buyer.get('created_at'), str):
            buyer['created_at'] = datetime.fromisoformat(buyer['created_at'])
    return buyers

@api_router.post("/sales/orders", response_model=SalesOrder)
async def create_sales_order(order_data: SalesOrderCreate, current_user: User = Depends(get_current_user)):
    buyer = await db.buyers.find_one({"id": order_data.buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    total_value = order_data.quantity_kg * order_data.rate_per_kg_usd
    
    sales_order = SalesOrder(
        order_number=generate_order_num(),
        buyer_id=order_data.buyer_id,
        buyer_name=buyer['company_name'],
        quantity_kg=order_data.quantity_kg,
        rate_per_kg_usd=order_data.rate_per_kg_usd,
        currency=order_data.currency,
        total_value_usd=total_value,
        delivery_date=order_data.delivery_date,
        notes=order_data.notes,
        created_by=current_user.id
    )
    
    order_dict = sales_order.model_dump()
    order_dict['created_at'] = order_dict['created_at'].isoformat()
    order_dict['delivery_date'] = order_dict['delivery_date'].isoformat()
    
    await db.sales_orders.insert_one(order_dict)
    await create_audit_log(current_user.id, "CREATE_SALES_ORDER", "sales", {"order_id": sales_order.id})
    return sales_order

@api_router.get("/sales/orders", response_model=List[SalesOrder])
async def get_sales_orders(current_user: User = Depends(get_current_user)):
    orders = await db.sales_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('delivery_date'), str):
            order['delivery_date'] = datetime.fromisoformat(order['delivery_date'])
    return orders

@api_router.post("/shipments", response_model=Shipment)
async def create_shipment(shipment_data: ShipmentCreate, current_user: User = Depends(get_current_user)):
    shipment = Shipment(
        shipment_number=generate_shipment_number(),
        sales_order_id=shipment_data.sales_order_id,
        container_no=shipment_data.container_no,
        seal_no=shipment_data.seal_no,
        shipping_line=shipment_data.shipping_line,
        vessel_name=shipment_data.vessel_name,
        port_of_loading=shipment_data.port_of_loading,
        port_of_discharge=shipment_data.port_of_discharge,
        destination_country=shipment_data.destination_country,
        etd=shipment_data.etd,
        eta=shipment_data.eta,
        bill_of_lading=shipment_data.bill_of_lading,
        created_by=current_user.id
    )
    
    shipment_dict = shipment.model_dump()
    shipment_dict['created_at'] = shipment_dict['created_at'].isoformat()
    shipment_dict['etd'] = shipment_dict['etd'].isoformat()
    shipment_dict['eta'] = shipment_dict['eta'].isoformat()
    
    await db.shipments.insert_one(shipment_dict)
    await create_audit_log(current_user.id, "CREATE_SHIPMENT", "sales", {"shipment_id": shipment.id})
    return shipment

@api_router.get("/shipments", response_model=List[Shipment])
async def get_shipments(current_user: User = Depends(get_current_user)):
    shipments = await db.shipments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for shipment in shipments:
        if isinstance(shipment.get('created_at'), str):
            shipment['created_at'] = datetime.fromisoformat(shipment['created_at'])
        if isinstance(shipment.get('etd'), str):
            shipment['etd'] = datetime.fromisoformat(shipment['etd'])
        if isinstance(shipment.get('eta'), str):
            shipment['eta'] = datetime.fromisoformat(shipment['eta'])
    return shipments

# Wage & Billing endpoints
@api_router.post("/wage-bills", response_model=WageBill)
async def create_wage_bill(bill_data: WageBillCreate, current_user: User = Depends(get_current_user)):
    net_payable = bill_data.gross_amount - bill_data.tds_deduction
    
    wage_bill = WageBill(
        bill_number=generate_bill_number(),
        bill_type=bill_data.bill_type,
        period_from=bill_data.period_from,
        period_to=bill_data.period_to,
        department=bill_data.department,
        gross_amount=bill_data.gross_amount,
        tds_deduction=bill_data.tds_deduction,
        net_payable=net_payable,
        notes=bill_data.notes,
        created_by=current_user.id
    )
    
    bill_dict = wage_bill.model_dump()
    bill_dict['created_at'] = bill_dict['created_at'].isoformat()
    bill_dict['period_from'] = bill_dict['period_from'].isoformat()
    bill_dict['period_to'] = bill_dict['period_to'].isoformat()
    if bill_dict.get('payment_date'):
        bill_dict['payment_date'] = bill_dict['payment_date'].isoformat()
    
    await db.wage_bills.insert_one(bill_dict)
    await create_audit_log(current_user.id, "CREATE_WAGE_BILL", "accounts", {"bill_id": wage_bill.id})
    return wage_bill

@api_router.get("/wage-bills", response_model=List[WageBill])
async def get_wage_bills(current_user: User = Depends(get_current_user)):
    bills = await db.wage_bills.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for bill in bills:
        if isinstance(bill.get('created_at'), str):
            bill['created_at'] = datetime.fromisoformat(bill['created_at'])
        if isinstance(bill.get('period_from'), str):
            bill['period_from'] = datetime.fromisoformat(bill['period_from'])
        if isinstance(bill.get('period_to'), str):
            bill['period_to'] = datetime.fromisoformat(bill['period_to'])
        if bill.get('payment_date') and isinstance(bill['payment_date'], str):
            bill['payment_date'] = datetime.fromisoformat(bill['payment_date'])
    return bills

# Universal Attachments & Notes
@api_router.post("/attachments", response_model=Attachment)
async def create_attachment(attachment_data: AttachmentCreate, current_user: User = Depends(get_current_user)):
    attachment = Attachment(
        entity_type=attachment_data.entity_type,
        entity_id=attachment_data.entity_id,
        file_name=attachment_data.file_name,
        file_url=f"/uploads/{attachment_data.file_name}",
        file_size_kb=0.0,
        mime_type="application/octet-stream",
        category=attachment_data.category,
        description=attachment_data.description,
        uploaded_by=current_user.id
    )
    
    attachment_dict = attachment.model_dump()
    attachment_dict['created_at'] = attachment_dict['created_at'].isoformat()
    
    await db.attachments.insert_one(attachment_dict)
    return attachment

@api_router.get("/attachments/{entity_type}/{entity_id}", response_model=List[Attachment])
async def get_attachments(entity_type: str, entity_id: str, current_user: User = Depends(get_current_user)):
    attachments = await db.attachments.find(
        {"entity_type": entity_type, "entity_id": entity_id, "is_deleted": False},
        {"_id": 0}
    ).to_list(1000)
    for attachment in attachments:
        if isinstance(attachment.get('created_at'), str):
            attachment['created_at'] = datetime.fromisoformat(attachment['created_at'])
    return attachments

@api_router.post("/notes", response_model=Note)
async def create_note(note_data: NoteCreate, current_user: User = Depends(get_current_user)):
    is_admin_note = current_user.role in [UserRole.admin, UserRole.owner]
    
    note = Note(
        entity_type=note_data.entity_type,
        entity_id=note_data.entity_id,
        note_text=note_data.note_text,
        is_pinned=note_data.is_pinned,
        is_admin_note=is_admin_note,
        authored_by=current_user.id,
        author_name=current_user.name
    )
    
    note_dict = note.model_dump()
    note_dict['created_at'] = note_dict['created_at'].isoformat()
    
    await db.notes.insert_one(note_dict)
    return note

@api_router.get("/notes/{entity_type}/{entity_id}", response_model=List[Note])
async def get_notes(entity_type: str, entity_id: str, current_user: User = Depends(get_current_user)):
    notes = await db.notes.find(
        {"entity_type": entity_type, "entity_id": entity_id, "is_deleted": False},
        {"_id": 0}
    ).sort([("is_pinned", -1), ("created_at", -1)]).to_list(1000)
    for note in notes:
        if isinstance(note.get('created_at'), str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
    return notes



# Approval Workflow Endpoints
@api_router.get("/admin/pending-approvals", response_model=List[PendingApproval])
async def get_pending_approvals(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.owner, UserRole.production_supervisor]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    approvals = await db.pending_approvals.find(
        {"approval_status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for approval in approvals:
        if isinstance(approval.get('created_at'), str):
            approval['created_at'] = datetime.fromisoformat(approval['created_at'])
    return approvals

@api_router.post("/admin/approve-action")
async def handle_approval(action_data: ApprovalAction, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.owner, UserRole.production_supervisor]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    approval = await db.pending_approvals.find_one({"id": action_data.approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    # Update approval status
    new_status = ApprovalStatus.approved if action_data.action == "approve" else ApprovalStatus.rejected
    
    await db.pending_approvals.update_one(
        {"id": action_data.approval_id},
        {"$set": {
            "approval_status": new_status.value,
            "approved_by": current_user.id,
            "approval_notes": action_data.notes
        }}
    )
    
    # If approved, apply changes to the actual entity
    if action_data.action == "approve":
        entity_type = approval['entity_type']
        entity_id = approval['entity_id']
        new_data = approval['new_data']
        
        if entity_type == "procurement_lot":
            await db.procurement_lots.update_one(
                {"id": entity_id},
                {"$set": {
                    **new_data,
                    "is_update_pending_approval": False,
                    "approval_status": "approved",
                    "approved_by": current_user.id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    await create_audit_log(current_user.id, f"APPROVAL_{action_data.action.upper()}", "admin", {
        "approval_id": action_data.approval_id,
        "entity_type": approval['entity_type'],
        "entity_id": approval['entity_id']
    })
    
    return {"message": f"Successfully {action_data.action}d", "status": new_status.value}


# File Upload Endpoint
@api_router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    entity_display: str = Form(...),
    stage: str = Form(...),
    count_per_kg_visible: Optional[str] = Form(None),
    tray_count_visible: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    # Generate unique filename
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{entity_type}_{entity_id}_{uuid.uuid4()}.{file_extension}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create photo tracker record
    photo_url = f"/uploads/{unique_filename}"
    tray_count = int(tray_count_visible) if tray_count_visible and tray_count_visible.isdigit() else None
    
    photo = PhotoTracker(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_display=entity_display,
        stage=stage,
        photo_url=photo_url,
        count_per_kg_visible=count_per_kg_visible,
        tray_count_visible=tray_count,
        uploaded_by=current_user.id,
        uploader_name=current_user.name
    )
    
    photo_dict = photo.model_dump()
    photo_dict['created_at'] = photo_dict['created_at'].isoformat()
    
    await db.photo_tracker.insert_one(photo_dict)
    
    # Update entity's photos array
    collection_map = {
        "procurement_lot": "procurement_lots",
        "preprocessing_batch": "preprocessing_batches",
        "production_order": "production_orders"
    }
    
    if entity_type in collection_map:
        collection = db[collection_map[entity_type]]
        await collection.update_one(
            {"id": entity_id},
            {"$push": {"photos": photo_url}}
        )
    
    return {"photo_url": photo_url, "photo_id": photo.id, "message": "File uploaded successfully"}


# ============================================================================
# WASTAGE TRACKING ENDPOINTS (v4.0)
# ============================================================================

# Yield Benchmarks CRUD
@api_router.post("/yield-benchmarks", response_model=YieldBenchmark)
async def create_yield_benchmark(
    benchmark_data: YieldBenchmarkCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ['admin', 'owner']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    benchmark = YieldBenchmark(**benchmark_data.model_dump(), set_by=current_user.id)
    benchmark_dict = benchmark.model_dump()
    benchmark_dict['created_at'] = benchmark_dict['created_at'].isoformat()
    if benchmark_dict.get('updated_at'):
        benchmark_dict['updated_at'] = benchmark_dict['updated_at'].isoformat()
    
    await db.yield_benchmarks.insert_one(benchmark_dict)
    return benchmark

@api_router.get("/yield-benchmarks", response_model=List[YieldBenchmark])
async def get_yield_benchmarks(current_user: User = Depends(get_current_user)):
    benchmarks = await db.yield_benchmarks.find({}, {"_id": 0}).to_list(1000)
    return benchmarks

@api_router.get("/yield-benchmarks/{benchmark_id}", response_model=YieldBenchmark)
async def get_yield_benchmark(benchmark_id: str, current_user: User = Depends(get_current_user)):
    benchmark = await db.yield_benchmarks.find_one({"id": benchmark_id}, {"_id": 0})
    if not benchmark:
        raise HTTPException(status_code=404, detail="Benchmark not found")
    return benchmark

@api_router.put("/yield-benchmarks/{benchmark_id}", response_model=YieldBenchmark)
async def update_yield_benchmark(
    benchmark_id: str,
    benchmark_data: YieldBenchmarkCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ['admin', 'owner']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = benchmark_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.yield_benchmarks.update_one(
        {"id": benchmark_id},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Benchmark not found")
    
    updated = await db.yield_benchmarks.find_one({"id": benchmark_id}, {"_id": 0})
    return updated

@api_router.delete("/yield-benchmarks/{benchmark_id}")
async def delete_yield_benchmark(benchmark_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'owner']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.yield_benchmarks.delete_one({"id": benchmark_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Benchmark not found")
    
    return {"message": "Benchmark deleted successfully"}

# Market Rates CRUD
@api_router.post("/market-rates", response_model=MarketRate)
async def create_market_rate(
    rate_data: MarketRateCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ['admin', 'owner']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    rate = MarketRate(**rate_data.model_dump(), set_by=current_user.id)
    rate_dict = rate.model_dump()
    rate_dict['created_at'] = rate_dict['created_at'].isoformat()
    rate_dict['effective_from'] = rate_dict['effective_from'].isoformat()
    if rate_dict.get('effective_to'):
        rate_dict['effective_to'] = rate_dict['effective_to'].isoformat()
    
    await db.market_rates.insert_one(rate_dict)
    return rate

@api_router.get("/market-rates", response_model=List[MarketRate])
async def get_market_rates(current_user: User = Depends(get_current_user)):
    rates = await db.market_rates.find({}, {"_id": 0}).sort("effective_from", -1).to_list(1000)
    return rates

@api_router.get("/market-rates/active", response_model=List[MarketRate])
async def get_active_market_rates(current_user: User = Depends(get_current_user)):
    today = date.today().isoformat()
    rates = await db.market_rates.find({
        "effective_from": {"$lte": today},
        "$or": [
            {"effective_to": None},
            {"effective_to": {"$gte": today}}
        ]
    }, {"_id": 0}).to_list(1000)
    return rates

# Lot Stage Wastage
@api_router.post("/lot-stage-wastage", response_model=LotStageWastage)
async def create_lot_stage_wastage(
    wastage_data: LotStageWastageCreate,
    current_user: User = Depends(get_current_user)
):
    # Calculate derived fields
    wastage_kg = wastage_data.input_weight_kg - wastage_data.output_weight_kg
    yield_pct = (wastage_data.output_weight_kg / wastage_data.input_weight_kg * 100) if wastage_data.input_weight_kg > 0 else 0
    
    # Look up benchmark thresholds
    lot = await db.procurement_lots.find_one({"id": wastage_data.lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    benchmark = await db.yield_benchmarks.find_one({
        "species": lot['species'],
        "process_type": wastage_data.process_type,
        "is_active": True
    }, {"_id": 0})
    
    # Calculate threshold status
    threshold_status = "info"
    min_yield_pct = None
    optimal_yield_pct = None
    
    if benchmark:
        min_yield_pct = benchmark.get('min_yield_pct')
        optimal_yield_pct = benchmark.get('optimal_yield_pct')
        
        if min_yield_pct and optimal_yield_pct:
            if yield_pct >= optimal_yield_pct:
                threshold_status = "green"
            elif yield_pct >= min_yield_pct:
                threshold_status = "amber"
            else:
                threshold_status = "red"
    
    # Look up market rate
    rate_per_kg = None
    if benchmark and benchmark.get('reference_rate_per_kg'):
        rate_per_kg = benchmark['reference_rate_per_kg']
    else:
        rate_per_kg = lot.get('rate_per_kg', 0)
    
    # Calculate revenue loss
    revenue_loss_inr = wastage_kg * rate_per_kg if rate_per_kg else 0
    
    wastage = LotStageWastage(
        **wastage_data.model_dump(),
        wastage_kg=wastage_kg,
        yield_pct=round(yield_pct, 2),
        min_yield_pct=min_yield_pct,
        optimal_yield_pct=optimal_yield_pct,
        threshold_status=threshold_status,
        rate_per_kg_used=rate_per_kg,
        revenue_loss_inr=revenue_loss_inr,
        net_loss_inr=revenue_loss_inr,
        is_alert=(threshold_status == "red"),
        recorded_by=current_user.id
    )
    
    wastage_dict = wastage.model_dump()
    wastage_dict['created_at'] = wastage_dict['created_at'].isoformat()
    if wastage_dict.get('updated_at'):
        wastage_dict['updated_at'] = wastage_dict['updated_at'].isoformat()
    if wastage_dict.get('alert_ack_at'):
        wastage_dict['alert_ack_at'] = wastage_dict['alert_ack_at'].isoformat()
    
    await db.lot_stage_wastage.insert_one(wastage_dict)
    
    # Create alert notification if red
    if wastage.is_alert:
        notification = Notification(
            title=f"🔴 Yield Alert: {wastage.stage_name} below minimum threshold",
            message=f"Lot {lot['lot_number']} {wastage.stage_name}: {yield_pct:.2f}% yield (min: {min_yield_pct}%)\nWastage: {wastage_kg:.2f} kg | Revenue loss: ₹{revenue_loss_inr:.2f}",
            type="alert",
            priority="urgent",
            target_roles=['admin', 'owner', 'production_supervisor'],
            created_by=current_user.id
        )
        notif_dict = notification.model_dump()
        notif_dict['created_at'] = notif_dict['created_at'].isoformat()
        await db.notifications.insert_one(notif_dict)
    
    return wastage

@api_router.get("/lot-stage-wastage/{lot_id}", response_model=List[LotStageWastage])
async def get_lot_wastage(lot_id: str, current_user: User = Depends(get_current_user)):
    wastage_records = await db.lot_stage_wastage.find(
        {"lot_id": lot_id},
        {"_id": 0}
    ).sort("stage_sequence", 1).to_list(1000)
    return wastage_records

# Wastage Dashboard
@api_router.get("/wastage/dashboard-stats", response_model=WastageDashboardStats)
async def get_wastage_dashboard_stats(current_user: User = Depends(get_current_user)):
    today = date.today()
    month_start = date(today.year, today.month, 1)
    
    # Today's wastage
    today_wastage = await db.lot_stage_wastage.aggregate([
        {
            "$match": {
                "created_at": {"$regex": f"^{today.isoformat()}"}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_wastage_kg": {"$sum": "$wastage_kg"},
                "unique_lots": {"$addToSet": "$lot_id"}
            }
        }
    ]).to_list(1)
    
    today_wastage_kg = today_wastage[0]['total_wastage_kg'] if today_wastage else 0
    today_lots_count = len(today_wastage[0]['unique_lots']) if today_wastage else 0
    
    # This month's revenue loss
    month_loss = await db.lot_stage_wastage.aggregate([
        {
            "$match": {
                "created_at": {"$regex": f"^{month_start.isoformat()[:7]}"}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_loss": {"$sum": "$net_loss_inr"},
                "byproduct_revenue": {"$sum": "$byproduct_revenue_inr"},
                "unique_lots": {"$addToSet": "$lot_id"}
            }
        }
    ]).to_list(1)
    
    month_revenue_loss = month_loss[0]['total_loss'] if month_loss else 0
    byproduct_revenue = month_loss[0]['byproduct_revenue'] if month_loss else 0
    month_lots_count = len(month_loss[0]['unique_lots']) if month_loss else 0
    
    # Active red alerts
    active_alerts = await db.lot_stage_wastage.count_documents({
        "is_alert": True,
        "alert_acknowledged": False
    })
    
    return WastageDashboardStats(
        today_wastage_kg=today_wastage_kg,
        today_lots_count=today_lots_count,
        month_revenue_loss_inr=month_revenue_loss,
        month_lots_count=month_lots_count,
        active_red_alerts=active_alerts,
        byproduct_revenue_inr=byproduct_revenue
    )

@api_router.get("/wastage/breach-alerts", response_model=List[WastageBreachAlert])
async def get_wastage_breach_alerts(current_user: User = Depends(get_current_user)):
    alerts = await db.lot_stage_wastage.find({
        "is_alert": True,
        "alert_acknowledged": False
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    result = []
    for alert in alerts:
        lot = await db.procurement_lots.find_one({"id": alert['lot_id']}, {"_id": 0, "lot_number": 1, "species": 1})
        if lot:
            variance_pct = alert['yield_pct'] - alert['min_yield_pct'] if alert.get('min_yield_pct') else 0
            result.append(WastageBreachAlert(
                id=alert['id'],
                lot_id=alert['lot_id'],
                lot_number=lot['lot_number'],
                stage_name=alert['stage_name'],
                species=lot['species'],
                actual_yield_pct=alert['yield_pct'],
                min_threshold_pct=alert.get('min_yield_pct', 0),
                variance_pct=variance_pct,
                loss_inr=alert['net_loss_inr'],
                created_at=alert['created_at'] if isinstance(alert['created_at'], datetime) else datetime.fromisoformat(alert['created_at'])
            ))
    
    return result

@api_router.post("/wastage/acknowledge/{wastage_id}")
async def acknowledge_wastage_alert(wastage_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'owner', 'production_supervisor']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.lot_stage_wastage.update_one(
        {"id": wastage_id},
        {
            "$set": {
                "alert_acknowledged": True,
                "alert_ack_by": current_user.id,
                "alert_ack_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Wastage record not found")
    
    return {"message": "Alert acknowledged successfully"}

@api_router.get("/wastage/stage-summary")
async def get_stage_wastage_summary(current_user: User = Depends(get_current_user)):
    # Get this month's stage-wise wastage
    month_start = date.today().replace(day=1).isoformat()
    
    summary = await db.lot_stage_wastage.aggregate([
        {
            "$match": {
                "created_at": {"$regex": f"^{month_start[:7]}"}
            }
        },
        {
            "$group": {
                "_id": "$stage_name",
                "total_input_kg": {"$sum": "$input_weight_kg"},
                "total_wastage_kg": {"$sum": "$wastage_kg"},
                "avg_yield_pct": {"$avg": "$yield_pct"},
                "red_count": {
                    "$sum": {"$cond": [{"$eq": ["$threshold_status", "red"]}, 1, 0]}
                },
                "amber_count": {
                    "$sum": {"$cond": [{"$eq": ["$threshold_status", "amber"]}, 1, 0]}
                },
                "green_count": {
                    "$sum": {"$cond": [{"$eq": ["$threshold_status", "green"]}, 1, 0]}
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]).to_list(100)
    
    return summary


@api_router.get("/wastage/lot-waterfall/{lot_id}")
async def get_lot_waterfall(lot_id: str, current_user: User = Depends(get_current_user)):
    """Get complete waterfall view of a lot showing all stages and wastage"""
    # Get lot details
    lot = await db.procurement_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Get all wastage records for this lot
    wastage_records = await db.lot_stage_wastage.find(
        {"lot_id": lot_id}, 
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Calculate total losses
    total_wastage_kg = sum(w.get("wastage_kg", 0) for w in wastage_records)
    total_revenue_loss = sum(w.get("revenue_loss_inr", 0) for w in wastage_records)
    total_net_loss = sum(w.get("net_loss_inr", 0) for w in wastage_records)
    
    # Build waterfall stages
    stages = []
    current_weight = lot.get("gross_weight_kg", 0)
    
    for record in wastage_records:
        stages.append({
            "stage_name": record.get("stage_name", "Unknown"),
            "process_type": record.get("process_type", "Unknown"),
            "input_weight_kg": record.get("input_weight_kg", 0),
            "output_weight_kg": record.get("output_weight_kg", 0),
            "wastage_kg": record.get("wastage_kg", 0),
            "yield_pct": record.get("yield_pct", 0),
            "threshold_status": record.get("threshold_status", "info"),
            "revenue_loss_inr": record.get("revenue_loss_inr", 0),
            "net_loss_inr": record.get("net_loss_inr", 0),
            "created_at": record.get("created_at", "")
        })
    
    return {
        "lot_id": lot_id,
        "lot_number": lot.get("lot_number", ""),
        "species": lot.get("species", ""),
        "agent_name": lot.get("agent_name", ""),
        "initial_weight_kg": lot.get("gross_weight_kg", 0),
        "final_weight_kg": stages[-1].get("output_weight_kg", 0) if stages else lot.get("net_weight_kg", 0),
        "total_wastage_kg": total_wastage_kg,
        "total_revenue_loss_inr": total_revenue_loss,
        "total_net_loss_inr": total_net_loss,
        "stages": stages
    }




# Photo Tracker Endpoints
@api_router.post("/admin/photos", response_model=PhotoTracker)
async def upload_photo_tracking(photo_data: PhotoUpload, current_user: User = Depends(get_current_user)):
    photo = PhotoTracker(
        entity_type=photo_data.entity_type,
        entity_id=photo_data.entity_id,
        entity_display=photo_data.entity_display,
        stage=photo_data.stage,
        photo_url=photo_data.photo_url,
        count_per_kg_visible=photo_data.count_per_kg_visible,
        tray_count_visible=photo_data.tray_count_visible,
        uploaded_by=current_user.id,
        uploader_name=current_user.name,
        notes=photo_data.notes
    )
    
    photo_dict = photo.model_dump()
    photo_dict['created_at'] = photo_dict['created_at'].isoformat()
    
    await db.photo_tracker.insert_one(photo_dict)
    
    # Also update the entity's photos array
    collection_map = {
        "procurement_lot": "procurement_lots",
        "preprocessing_batch": "preprocessing_batches",
        "production_order": "production_orders"
    }
    
    if photo_data.entity_type in collection_map:
        collection = db[collection_map[photo_data.entity_type]]
        await collection.update_one(
            {"id": photo_data.entity_id},
            {"$push": {"photos": photo_data.photo_url}}
        )
    
    return photo

@api_router.get("/admin/photos", response_model=List[PhotoTracker])
async def get_all_photos(stage: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"stage": stage} if stage else {}
    photos = await db.photo_tracker.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for photo in photos:
        if isinstance(photo.get('created_at'), str):
            photo['created_at'] = datetime.fromisoformat(photo['created_at'])
    return photos

# Live Price Tracking
@api_router.get("/live-prices", response_model=List[LivePriceData])
async def get_live_prices(current_user: User = Depends(get_current_user)):
    # Mock data for now - in production, this would fetch from external API or database
    mock_prices = [
        {
            "id": str(uuid.uuid4()),
            "category": "Vannamei 30/40",
            "price_per_kg": 420.0,
            "location": "Andhra Pradesh",
            "market": "Nellore",
            "date": datetime.now(timezone.utc),
            "source": "Market Data"
        },
        {
            "id": str(uuid.uuid4()),
            "category": "Vannamei 40/60",
            "price_per_kg": 380.0,
            "location": "Andhra Pradesh",
            "market": "Kakinada",
            "date": datetime.now(timezone.utc),
            "source": "Market Data"
        },
        {
            "id": str(uuid.uuid4()),
            "category": "Vannamei 60/80",
            "price_per_kg": 340.0,
            "location": "Andhra Pradesh",
            "market": "Bhimavaram",
            "date": datetime.now(timezone.utc),
            "source": "Market Data"
        },
        {
            "id": str(uuid.uuid4()),
            "category": "Black Tiger 20/30",
            "price_per_kg": 650.0,
            "location": "Andhra Pradesh",
            "market": "Nellore",
            "date": datetime.now(timezone.utc),
            "source": "Market Data"
        },
        {
            "id": str(uuid.uuid4()),
            "category": "Black Tiger 30/40",
            "price_per_kg": 580.0,
            "location": "Andhra Pradesh",
            "market": "Kakinada",
            "date": datetime.now(timezone.utc),
            "source": "Market Data"
        }
    ]
    
    return mock_prices

# Traceability View
@api_router.get("/traceability/{lot_number}", response_model=TraceabilityRecord)
async def get_traceability(lot_number: str, current_user: User = Depends(get_current_user)):
    # Get procurement lot
    lot = await db.procurement_lots.find_one({"lot_number": lot_number}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Get preprocessing batches
    batches = await db.preprocessing_batches.find({"procurement_lot_id": lot['id']}, {"_id": 0}).to_list(1000)
    
    # Get production orders
    batch_ids = [b['id'] for b in batches]
    orders = []
    if batch_ids:
        orders = await db.production_orders.find(
            {"preprocessing_batch_ids": {"$in": batch_ids}},
            {"_id": 0}
        ).to_list(1000)
    
    # Get finished goods
    order_ids = [o['id'] for o in orders]
    finished_goods = []
    if order_ids:
        finished_goods = await db.finished_goods.find(
            {"production_order_id": {"$in": order_ids}},
            {"_id": 0}
        ).to_list(1000)
    
    # Get cold storage inventory
    fg_ids = [fg['id'] for fg in finished_goods]
    cold_storage = []
    if fg_ids:
        cold_storage = await db.cold_storage_inventory.find(
            {"fg_id": {"$in": fg_ids}},
            {"_id": 0}
        ).to_list(1000)
    
    # Get shipments
    shipment = None
    if order_ids:
        shipment = await db.shipments.find_one(
            {"sales_order_id": {"$in": order_ids}},
            {"_id": 0}
        )
    
    # Track count per kg changes
    count_changes = [lot.get('count_per_kg', 'N/A')]
    for order in orders:
        if order.get('target_size_count'):
            count_changes.append(order['target_size_count'])
    
    # Calculate total trays
    total_trays = lot.get('no_of_trays', 0)
    for batch in batches:
        total_trays += batch.get('no_of_trays', 0)
    
    # Get photos count
    photos_count = await db.photo_tracker.count_documents({"entity_id": lot['id']})
    
    return TraceabilityRecord(
        lot_number=lot_number,
        procurement_data=lot,
        preprocessing_data=batches,
        production_data=orders,
        finished_goods_data=finished_goods,
        cold_storage_data=cold_storage,
        shipment_data=shipment,
        total_count_per_kg_changes=count_changes,
        total_tray_count=total_trays,
        photos_count=photos_count
    )

# Update procurement lot endpoint to require approval
@api_router.put("/procurement/lots/{lot_id}")
async def update_procurement_lot(
    lot_id: str,
    updates: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    lot = await db.procurement_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    
    # Create pending approval
    pending_approval = PendingApproval(
        entity_type="procurement_lot",
        entity_id=lot_id,
        entity_display=lot['lot_number'],
        change_type="update",
        old_data=lot,
        new_data=updates,
        requested_by=current_user.id,
        requester_name=current_user.name
    )
    
    approval_dict = pending_approval.model_dump()
    approval_dict['created_at'] = approval_dict['created_at'].isoformat()
    
    await db.pending_approvals.insert_one(approval_dict)
    
    # Mark lot as pending approval
    await db.procurement_lots.update_one(
        {"id": lot_id},
        {"$set": {"is_update_pending_approval": True}}
    )
    
    return {
        "message": "Update request submitted for approval",
        "approval_id": pending_approval.id,
        "requires_approval_from": ["admin", "owner", "production_supervisor"]
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()