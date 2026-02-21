from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
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
    notes: Optional[str] = None
    attachments: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProcurementLotCreate(BaseModel):
    agent_id: str
    vehicle_number: str
    driver_name: str
    arrival_time: datetime
    species: Species
    count_per_kg: str
    boxes_count: int
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