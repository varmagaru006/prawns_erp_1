from enum import Enum

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
    approved = "approved"
    rejected = "rejected"
    hold = "hold"

class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
