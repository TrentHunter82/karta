# Specification Template

Use this as a starting point when running the Architect Agent, or fill it in manually for simple projects.

---

## Project Overview

**Name:** [app-name]
**Description:** [One paragraph describing what this app does]
**Primary Users:** [Who will use this app]
**Core Problem:** [What problem does it solve]

---

## Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand (or "local state only" for simple apps)
- **Form Handling:** React Hook Form + Zod
- **HTTP Client:** Native fetch with typed wrapper

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express.js with TypeScript
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **ORM:** Drizzle ORM
- **Auth:** JWT (HS256, 24h expiry)
- **Validation:** Zod

### Infrastructure
- **Monorepo:** No (separate frontend/backend folders)
- **Deployment:** [Vercel/Railway/Docker]

---

## File Structure

```
[app-name]/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── [other primitives]
│   │   │   └── features/
│   │   │       └── [feature-specific components]
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── [other pages]
│   │   ├── hooks/
│   │   │   └── [custom hooks]
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   ├── stores/
│   │   │   └── authStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── [feature].routes.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── [feature].service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── seed.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── errors.ts
│   │   ├── app.ts
│   │   └── index.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## Data Models

### User
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto | |
| email | string | unique, required | max 255 chars |
| passwordHash | string | required | bcrypt, cost 12 |
| name | string | required | 2-100 chars |
| createdAt | datetime | auto | |
| updatedAt | datetime | auto-update | |

### [Model Name]
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| | | | |

---

## API Contracts

### Authentication

#### POST /api/auth/register
Creates a new user account.

**Auth:** Public

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token-string"
}
```

**Errors:**
| Code | Status | Condition |
|------|--------|-----------|
| VALIDATION_ERROR | 400 | Invalid email, weak password, missing fields |
| CONFLICT | 409 | Email already registered |

---

#### POST /api/auth/login
Authenticates existing user.

**Auth:** Public

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token-string"
}
```

**Errors:**
| Code | Status | Condition |
|------|--------|-----------|
| VALIDATION_ERROR | 400 | Missing email or password |
| INVALID_CREDENTIALS | 401 | Wrong email or password |

---

#### GET /api/auth/me
Returns current user info.

**Auth:** Required (Bearer token)

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Errors:**
| Code | Status | Condition |
|------|--------|-----------|
| UNAUTHORIZED | 401 | Missing or invalid token |

---

### [Feature Name]

#### [METHOD] /api/[endpoint]
[Description]

**Auth:** [Public | Required | Admin]

**Request:**
```json
{
}
```

**Response (XXX):**
```json
{
}
```

**Errors:**
| Code | Status | Condition |
|------|--------|-----------|

---

## Component Hierarchy

### Pages

**HomePage** (`/`)
```
├── Header
│   ├── Logo
│   └── NavLinks
│       └── NavLink (×n)
├── Hero
│   └── CTAButton
├── Features
│   └── FeatureCard (×3)
└── Footer
```

**LoginPage** (`/login`)
```
├── Header
├── LoginForm
│   ├── Input (email)
│   ├── Input (password)
│   ├── Button (submit)
│   └── Link (to register)
└── Footer
```

**DashboardPage** (`/dashboard`) [Protected]
```
├── DashboardHeader
│   ├── Logo
│   ├── SearchBar
│   └── UserMenu
│       └── Avatar
├── Sidebar
│   └── NavItem (×n)
└── MainContent
    └── [Varies by feature]
```

### Component Props

**Button**
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}
```

**Input**
```typescript
interface InputProps {
  label: string;
  name: string;
  type: 'text' | 'email' | 'password';
  placeholder?: string;
  error?: string;
  required?: boolean;
}
```

---

## State Management

### Global State (Zustand)

**authStore**
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}
```

### Local State Patterns

**Forms:** Use React Hook Form
```typescript
const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
});
```

**Loading/Error:**
```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

---

## Validation Rules

### Registration
| Field | Rules |
|-------|-------|
| email | Required, valid email format, max 255 chars |
| password | Required, min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| name | Required, 2-100 chars |

### Login
| Field | Rules |
|-------|-------|
| email | Required, valid email format |
| password | Required |

### [Feature Form]
| Field | Rules |
|-------|-------|

---

## Error Handling

### API Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Standard Error Codes
| Code | HTTP Status | Usage |
|------|-------------|-------|
| VALIDATION_ERROR | 400 | Request body validation failed |
| UNAUTHORIZED | 401 | Missing or invalid auth token |
| INVALID_CREDENTIALS | 401 | Wrong email/password |
| FORBIDDEN | 403 | Valid token, no permission |
| NOT_FOUND | 404 | Resource doesn't exist |
| CONFLICT | 409 | Duplicate resource |
| INTERNAL_ERROR | 500 | Unexpected server error |

### Frontend Error Handling
- Form validation errors → Inline under fields
- API errors → Toast notification
- Network errors → Retry prompt with fallback message

---

## Security Requirements

- **Passwords:** bcrypt with cost factor 12
- **JWT:** HS256, 24h expiry, stored in localStorage
- **CORS:** Allow only frontend origin in production
- **Rate Limiting:** 100 req/min on auth routes
- **Headers:** helmet.js defaults
- **Input:** All user input validated server-side with Zod

---

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```
