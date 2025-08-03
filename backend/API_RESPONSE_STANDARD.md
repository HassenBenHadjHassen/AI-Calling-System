# API Response Standard

All API endpoints in the backend now follow a standardized response format to ensure consistency and improve frontend integration.

## Response Format

### Success Responses

```typescript
{
  success: true,
  data: T,           // The actual response data
  message?: string   // Optional success message
}
```

### Error Responses

```typescript
{
  success: false,
  data: null,
  error: string      // Error message
}
```

## Implementation

The standardization is implemented using the `ResponseUtils` class located in `src/utils/responseUtils.ts`.

### Available Methods

#### Success Responses

- `ResponseUtils.success(res, data, message?, statusCode?)` - Standard success response
- `ResponseUtils.success(res, data, message, 201)` - Created response (201)

#### Error Responses

- `ResponseUtils.error(res, message, statusCode?)` - Standard error (500)
- `ResponseUtils.badRequest(res, message)` - Bad request (400)
- `ResponseUtils.unauthorized(res, message?)` - Unauthorized (401)
- `ResponseUtils.forbidden(res, message?)` - Forbidden (403)
- `ResponseUtils.notFound(res, message?)` - Not found (404)
- `ResponseUtils.conflict(res, message?)` - Conflict (409)
- `ResponseUtils.unprocessableEntity(res, message?)` - Unprocessable entity (422)

## Examples

### Success Response

```json
{
	"success": true,
	"data": {
		"id": "123",
		"name": "John Doe",
		"email": "john@example.com"
	},
	"message": "User created successfully"
}
```

### Error Response

```json
{
	"success": false,
	"data": null,
	"error": "User not found"
}
```

### Health Check Response

```json
{
	"success": true,
	"data": {
		"status": "ok",
		"timestamp": "2024-01-01T12:00:00.000Z",
		"environment": "development",
		"version": "1.0.0"
	}
}
```

## Updated Controllers

All controllers have been updated to use the standardized format:

- `LeadController` - All lead-related endpoints
- `CallController` - All call-related endpoints
- `CampaignController` - All campaign-related endpoints
- `AuthRoutes` - All authentication endpoints
- `app.ts` - Health check and error handlers

## Frontend Integration

The frontend `ApiResponse<T>` interface in `frontend/app/services/api.ts` already expects this format:

```typescript
export interface ApiResponse<T> {
	success: boolean;
	data: T;
	error?: string;
}
```

This ensures seamless integration between frontend and backend.

## Testing

Run the test script to verify the standardized responses:

```bash
cd backend
node test-standardized-responses.js
```

## Benefits

1. **Consistency** - All endpoints return the same response structure
2. **Type Safety** - TypeScript interfaces ensure proper typing
3. **Error Handling** - Standardized error responses make frontend error handling easier
4. **Maintainability** - Centralized response formatting reduces code duplication
5. **Frontend Integration** - Matches the expected frontend API response format
