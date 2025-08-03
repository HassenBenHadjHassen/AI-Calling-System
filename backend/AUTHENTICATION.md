# Authentication System Documentation

## Overview

The AI Calling System now features a robust, secure authentication system with the following improvements:

- **Password Hashing**: Secure bcrypt hashing with salt rounds
- **Role-Based Access Control**: Admin and user roles with permission middleware
- **JWT Token Management**: Secure token generation with proper expiration
- **Comprehensive Error Handling**: Detailed error codes and messages
- **User Management**: Registration, login, logout, and profile management
- **Token Refresh**: Ability to refresh tokens without re-authentication

## Security Features

### Password Security

- Passwords are hashed using bcrypt with 12 salt rounds
- Minimum password length of 8 characters enforced
- Secure password comparison using timing-safe methods

### JWT Token Security

- Tokens include user role for authorization
- 24-hour expiration with proper issuer/audience claims
- Token refresh capability
- Detailed error handling for expired/invalid tokens

### Role-Based Access Control

- `admin` role: Full system access
- `user` role: Limited access (can be customized per endpoint)
- `requireRole` middleware for endpoint protection

## API Endpoints

### Public Endpoints

#### POST `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**

```json
{
  "email": "admin@prestalib.com",
  "password": "admin123"
}
```

**Response:**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "admin@prestalib.com",
    "role": "admin"
  },
  "expiresIn": "24h"
}
```

#### POST `/api/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "email": "newuser@prestalib.com",
  "password": "securepassword123",
  "role": "user"
}
```

**Response:**

```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "3",
    "email": "newuser@prestalib.com",
    "role": "user"
  },
  "expiresIn": "24h"
}
```

### Protected Endpoints

All protected endpoints require the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

#### POST `/api/auth/logout`

Logout the current user (stateless - client should discard token).

**Response:**

```json
{
  "message": "Logout successful"
}
```

#### POST `/api/auth/refresh`

Refresh the current JWT token.

**Response:**

```json
{
  "message": "Token refreshed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "admin@prestalib.com",
    "role": "admin"
  },
  "expiresIn": "24h"
}
```

#### GET `/api/auth/profile`

Get the current user's profile information.

**Response:**

```json
{
  "user": {
    "id": "1",
    "email": "admin@prestalib.com",
    "role": "admin",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### GET `/api/auth/verify`

Verify that the current token is valid.

**Response:**

```json
{
  "message": "Token is valid",
  "user": {
    "id": "1",
    "email": "admin@prestalib.com",
    "role": "admin"
  }
}
```

## Error Codes

The authentication system provides detailed error codes for better client-side handling:

| Code                       | HTTP Status | Description                                |
| -------------------------- | ----------- | ------------------------------------------ |
| `MISSING_TOKEN`            | 401         | No authorization header provided           |
| `TOKEN_EXPIRED`            | 401         | JWT token has expired                      |
| `INVALID_TOKEN`            | 403         | JWT token is malformed or invalid          |
| `USER_NOT_FOUND`           | 403         | User not found or account inactive         |
| `MISSING_CREDENTIALS`      | 400         | Email or password missing from request     |
| `INVALID_CREDENTIALS`      | 401         | Invalid email or password                  |
| `WEAK_PASSWORD`            | 400         | Password doesn't meet minimum requirements |
| `USER_EXISTS`              | 409         | User with email already exists             |
| `AUTH_REQUIRED`            | 401         | Authentication required for endpoint       |
| `INSUFFICIENT_PERMISSIONS` | 403         | User doesn't have required role            |

## Default Users

The system comes with two default users:

### Admin User

- **Email**: `admin@prestalib.com`
- **Password**: `admin123`
- **Role**: `admin`
- **Access**: Full system access

### Regular User

- **Email**: `user@prestalib.com`
- **Password**: `admin123`
- **Role**: `user`
- **Access**: Limited access (customizable per endpoint)

## Middleware Usage

### Basic Authentication

```typescript
import { authenticateToken } from "../middleware/auth";

router.get("/protected-route", authenticateToken, (req, res) => {
  // Route is now protected
});
```

### Role-Based Protection

```typescript
import { authenticateToken, requireRole } from "../middleware/auth";

router.get(
  "/admin-only",
  authenticateToken,
  requireRole(["admin"]),
  (req, res) => {
    // Only admins can access this route
  }
);
```

### Multiple Roles

```typescript
router.get(
  "/manager-or-admin",
  authenticateToken,
  requireRole(["admin", "manager"]),
  (req, res) => {
    // Both admins and managers can access this route
  }
);
```

## Environment Variables

Make sure to set a strong JWT secret in your environment:

```env
JWT_SECRET=your-super-secure-secret-key-here
```

## Security Best Practices

1. **Use HTTPS in production** - JWT tokens should only be transmitted over secure connections
2. **Store tokens securely** - Use httpOnly cookies or secure storage on the client
3. **Implement token blacklisting** - For production, consider implementing a token blacklist for logout
4. **Regular token rotation** - Consider implementing automatic token refresh
5. **Rate limiting** - Implement rate limiting on authentication endpoints
6. **Input validation** - Always validate user input on the server side
7. **Logging** - Log authentication events for security monitoring

## Production Considerations

For production deployment, consider:

1. **Database Integration**: Replace in-memory user store with database
2. **Password Policies**: Implement stronger password requirements
3. **Account Lockout**: Implement account lockout after failed attempts
4. **Two-Factor Authentication**: Add 2FA support for enhanced security
5. **Session Management**: Implement proper session management
6. **Audit Logging**: Log all authentication and authorization events
7. **Token Blacklisting**: Implement Redis-based token blacklisting for logout

## Testing

You can test the authentication system using the provided endpoints:

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prestalib.com","password":"admin123"}'

# Use the returned token for protected endpoints
curl -X GET http://localhost:4000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
