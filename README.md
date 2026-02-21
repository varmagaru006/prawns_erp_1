# Prawn/Aquaculture Export ERP System

A production-ready, full-stack ERP system designed for Indian seafood processing and export plants. Manages the complete lifecycle from procurement to finished goods.

## 🚀 Features

### Core Modules

1. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control (RBAC)
   - Roles: Admin, Owner, Procurement Manager, Production Supervisor, QC Officer, Sales Manager, Accounts Manager, Worker

2. **Dashboard**
   - Real-time statistics
   - Procurement metrics (lots, weight, value)
   - Active batches and production orders
   - Finished goods inventory
   - Pending QC items
   - Recent activity feed

3. **Agent/Vendor Management**
   - Complete vendor profiles
   - GST and PAN tracking
   - Commission management
   - Bank account details

4. **Procurement Module**
   - Lot entry with vehicle and driver details
   - Species tracking (Vannamei, Black Tiger, Sea Tiger)
   - Count per KG (30/40, 50/60, 80/100, etc.)
   - **Auto-calculated fields:**
     - Net weight = Gross weight - Ice weight
     - Number of tons = Net weight / 1000
     - Total amount = Net weight × Rate per KG
     - Balance due = Total amount - Advance paid
   - Gate QC (freshness grade, ice ratio)
   - Payment tracking (pending/partial/paid/overdue)
   - **Auto-generated PDF receipts**

5. **Pre-Processing Module**
   - Batch management linked to procurement lots
   - Process types: Heading, Peeling, Deveining, IQF, Blanching, Grading
   - Worker assignment and tracking
   - **Auto-calculated fields:**
     - Waste weight = Input - Output
     - Yield % = (Output / Input) × 100
     - Duration in minutes
   - Yield alerts when below 75%

6. **Production Module**
   - Production order creation
   - Product forms: HOSO, HLSO, PTO, PD, PDTO, Butterfly, Ring Cut, Cooked
   - Glazing percentage tracking
   - Block weight and count
   - **Auto-calculated conversion rate**
   - QC status management

7. **Finished Goods Module**
   - Unique FG codes with traceability
   - Cold storage location tracking
   - Temperature monitoring
   - Expiry date management
   - QC status (pending/passed/failed/on_hold)

8. **Notifications System**
   - In-app notifications
   - Role-based targeting
   - Module-specific alerts

9. **Audit Trail**
   - Complete activity logging
   - User action tracking
   - Timestamps for all operations

## 🛠️ Tech Stack

- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Frontend:** React.js with Tailwind CSS
- **UI Components:** Shadcn/UI
- **PDF Generation:** ReportLab
- **Authentication:** JWT with bcrypt

## 📦 Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB

### Backend Setup
```bash
cd /app/backend
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd /app/frontend
yarn install
```

### Environment Variables

**Backend (.env)**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=prawn_erp
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=*
```

**Frontend (.env)**
```
REACT_APP_BACKEND_URL=https://your-domain.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

## 🚦 Running the Application

The application uses supervisor for process management:

```bash
# Start all services
sudo supervisorctl start all

# Check status
sudo supervisorctl status

# Restart backend
sudo supervisorctl restart backend

# Restart frontend
sudo supervisorctl restart frontend
```

## 👤 Default Users

Create your first admin user through the registration page.

### Test Credentials (Development)
- Email: admin@prawnexport.com
- Password: admin123
- Role: Admin

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Agents
- `POST /api/agents` - Create agent
- `GET /api/agents` - List all agents
- `GET /api/agents/{id}` - Get agent details

### Procurement
- `POST /api/procurement/lots` - Create lot
- `GET /api/procurement/lots` - List all lots
- `GET /api/procurement/lots/{id}` - Get lot details
- `GET /api/procurement/lots/{id}/receipt` - Download PDF receipt

### Pre-Processing
- `POST /api/preprocessing/batches` - Create batch
- `GET /api/preprocessing/batches` - List all batches

### Production
- `POST /api/production/orders` - Create order
- `GET /api/production/orders` - List all orders

### Finished Goods
- `POST /api/finished-goods` - Create finished good
- `GET /api/finished-goods` - List all finished goods

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Notifications
- `POST /api/notifications` - Create notification (admin only)
- `GET /api/notifications` - Get user notifications

## 🎨 UI/UX Design

### Design Philosophy
- **Professional & Minimal:** Clean, distraction-free interface
- **Tablet-Friendly:** Optimized for plant floor usage with larger touch targets
- **Inter Font Family:** Modern, readable typography
- **Color Palette:**
  - Primary: Blue (#1e40af)
  - Success: Green (#10b981)
  - Warning: Yellow/Orange
  - Danger: Red (#ef4444)
  - Background: Slate gray (#f8fafc, #f1f5f9)

### Responsive Design
- Mobile: Single column layout with hamburger menu
- Tablet: Two-column grid for cards
- Desktop: Full sidebar navigation with three-column layout

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control
- Token expiration (8 hours)
- Protected API routes

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🧪 Testing

Testing has been completed with 100% backend API success rate:
- Authentication flows
- CRUD operations for all modules
- Auto-calculations verification
- PDF generation
- Role-based access control
- Data persistence

## 📈 Auto-Calculations Summary

| Module | Calculation | Formula |
|--------|-------------|---------|
| Procurement | Net Weight | Gross Weight - Ice Weight |
| Procurement | Tons | Net Weight / 1000 |
| Procurement | Total Amount | Net Weight × Rate per KG |
| Procurement | Balance Due | Total Amount - Advance Paid |
| Pre-Processing | Waste Weight | Input Weight - Output Weight |
| Pre-Processing | Yield % | (Output / Input) × 100 |
| Pre-Processing | Duration | End Time - Start Time (minutes) |
| Production | Conversion Rate | (Output / Input) × 100 |

## 🎯 Key Business Features

1. **Traceability:** Every lot, batch, and finished good has unique codes
2. **Payment Tracking:** Multi-status payment tracking (pending/partial/paid/overdue)
3. **Quality Control:** Freshness grades and QC status at multiple stages
4. **Yield Monitoring:** Automatic alerts for low yield percentages
5. **Worker Productivity:** Track KG processed and hours worked per worker
6. **Cold Storage:** Temperature monitoring and location tracking
7. **Commission Management:** Agent commission percentages
8. **Indian Market:** GST, PAN, rupee currency support

## 📝 Future Enhancements

- Cold Storage module expansion (detailed inventory management)
- QC module expansion (sample testing, lab reports)
- Sales & Dispatch module (order management, invoicing)
- Accounts module (wage calculation, commission reports)
- WhatsApp/SMS notifications via Twilio
- File attachments for lots, batches, and orders
- Advanced reporting and analytics
- Export documentation generation
- Multi-language support

## 🤝 Support

For issues or questions, please check:
1. Application logs: `/var/log/supervisor/backend.*.log` and `/var/log/supervisor/frontend.*.log`
2. Database connection
3. Environment variables configuration

## 📄 License

This project is proprietary software developed for aquaculture export businesses.

---

**Built with ❤️ for the Indian Seafood Export Industry**
