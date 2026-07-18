# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-platform dental equipment repair management system ("牙医仪器检修") with two frontend applications sharing a single uniCloud backend:

**1. Mini Program (Client-facing)** - Located in this directory (`3号/`)
- uni-app (Vue 3) cross-platform application
- Runs on WeChat Mini Program (primary target), Alipay, and potentially iOS/Android
- Used by customers to submit repair orders and track progress
- Directly calls uniCloud functions via `uniCloud.callFunction()`

**2. PC Admin Dashboard** - Located in `../pc-admin/`
- Vue 3 + Vite + Element Plus + Pinia
- Used by administrators and engineers to manage orders, knowledge base, and system settings
- Calls uniCloud functions via HTTP (cloud function URL化)
- Uses axios for HTTP requests

**Shared Backend**: uniCloud serverless architecture with cloud functions and cloud database (MongoDB-like).

## Architecture

### Mini Program Frontend Structure (this directory)

- **Pages**: `pages/` contains Vue SFC components for routes (index, login, company, mine)
- **API Layer**: `api/` provides abstraction over cloud functions with `USE_CLOUD` toggle
  - When `USE_CLOUD = true`: calls uniCloud functions via `callCloudFunction()`
  - When `USE_CLOUD = false`: falls back to HTTP requests
- **Store**: `store/auth.js` manages authentication state
- **Utils**: 
  - `utils/cloud.js`: Wrapper for uniCloud.callFunction with token injection
  - `utils/request.js`: HTTP request utility (fallback mode)

### PC Admin Frontend Structure (`../pc-admin/`)

- **Views**: `src/views/` contains page components (Login, OrderManagement, KnowledgeBase, etc.)
- **API Layer**: `src/api/` contains HTTP API wrappers (admin.js, order.js, kb.js)
- **Config**: `src/config/api.js` defines cloud function URL endpoints
- **Utils**: `src/utils/request.js` axios wrapper with token injection
- **Router**: `src/router/` Vue Router configuration
- **Store**: Pinia stores for state management
- **Components**: `src/components/` reusable UI components

### Backend Structure (uniCloud)

Cloud functions are in `uniCloud-alipay/cloudfunctions/`, organized by domain:

**Client-facing functions**:
- `cicada-client-user`: User authentication and profile
- `cicada-client-order`: Order creation and management
- `cicada-client-public`: Public content (guides, fault KB)

**Admin functions**:
- `cicada-admin-order`: Order management for engineers/admin
- `cicada-admin-kb`: Fault knowledge base management
- `cicada-admin-sys`: System settings and configuration

**Maintenance**:
- `cicada-maintenance`: Background jobs and data maintenance

### Database Collections

All collections use `cicada_` prefix:
- `cicada_users`: User accounts (role: client/engineer/admin)
- `cicada_orders`: Repair orders
- `cicada_order_items`: Order line items
- `cicada_user_devices`: User's registered devices
- `cicada_addresses`: User addresses
- `cicada_fault_kb`: Fault knowledge base
- `cicada_product_categories`: Product categories
- `cicada_feedbacks`: User feedback
- `cicada_guides`: User guides/help content
- `cicada_settings`: System settings
- `cicada_rate_limits`: API rate limiting

## Development Workflow

### Running the Project

**Mini Program** (this directory):
1. Open project in HBuilderX
2. Run → Run to Mini Program Simulator → WeChat Developer Tools
3. Or use CLI: `npm run dev:mp-weixin` (if configured)

**H5 Web** (this directory):
```bash
npm run dev:h5
```

**PC Admin Dashboard** (`../pc-admin/`):
```bash
cd ../pc-admin
npm install  # first time only
npm run dev  # starts Vite dev server on http://localhost:5173
```

**Build for production**:
```bash
# Mini Program: use HBuilderX → Publish
# PC Admin:
cd ../pc-admin
npm run build  # outputs to dist/
```

### Working with uniCloud

**Initialize uniCloud** (first time):
1. Open HBuilderX → uniCloud → Login to Alipay Cloud
2. Associate project with cloud space

**Deploy cloud functions**:
- Right-click function folder → Upload and deploy
- Or use CLI: `unicloud-cli deploy --function <function-name>`

**View logs**:
- HBuilderX → uniCloud → Cloud Functions/Database → View Logs
- Or use web console: https://unicloud.dcloud.net.cn

**Enable cloud function URL化 (for PC Admin)**:

PC Admin calls cloud functions via HTTP, so you must enable URL化 for admin functions:

1. Go to uniCloud web console → Cloud Functions
2. For each admin function (`cicada-admin-sys`, `cicada-admin-kb`, `cicada-admin-order`):
   - Click function name → Enable "云函数URL化"
   - Copy the generated URL (e.g., `https://fc-mp-xxxxx.next.bspapp.com/http/cicada-admin-sys`)
3. Update `../pc-admin/src/config/api.js` with the URLs:
```javascript
export const API_BASE = {
  adminSys: 'your-cicada-admin-sys-url',
  adminKb: 'your-cicada-admin-kb-url',
  adminOrder: 'your-cicada-admin-order-url'
}
```

See `../pc-admin/配置指南.md` for detailed setup instructions.

### Database Setup

**CRITICAL**: Database indexes must be manually created in uniCloud web console before production use.

See `INDEX_TASK.md` for complete index specifications. Key indexes:
- `cicada_orders.order_no`: **UNIQUE** index (prevents duplicate order numbers)
- Composite indexes on `user_id + create_time` for efficient user queries
- Composite indexes on `status + create_time` for status filtering

**To create indexes**:
1. Go to uniCloud Web Console → Cloud Database → Select collection → Index Management
2. For composite indexes: Click "Add Field" multiple times in same panel, then save together
3. Verify indexes are created before deploying to production

### Authentication Flow

**Mini Program (Client)**:
1. User enters phone number → `sendSmsCode` cloud function
2. User enters SMS code → `login` cloud function returns token
3. Token stored in `uni.getStorageSync('token')`
4. `callCloudFunction()` automatically injects token into all requests
5. Cloud functions validate token and return user info
6. On 401 error, token is cleared and user redirected to login

**PC Admin**:
1. Admin enters username/password → POST to `cicada-admin-sys` URL化接口
2. Backend validates credentials and returns token
3. Token stored in localStorage
4. axios interceptor (in `src/utils/request.js`) injects token in Authorization header
5. On 401 error, token is cleared and redirected to login page

### API Layer Pattern

**Mini Program** - When adding new API calls:

```javascript
// api/example.js
import { callCloudFunction } from '@/utils/cloud.js'

const USE_CLOUD = true

export const someAction = (params) => {
  if (USE_CLOUD) {
    return callCloudFunction('functionName', params)
  }
  // HTTP fallback (optional)
  return request({ url: '/path', method: 'POST', data: params })
}
```

**PC Admin** - When adding new API calls:

```javascript
// ../pc-admin/src/api/example.js
import request from '@/utils/request'
import { API_BASE } from '@/config/api'

export const someAction = (params) => {
  return request({
    url: `${API_BASE.adminSys}/someAction`,
    method: 'POST',
    data: params
  })
}
```

### Cloud Function Pattern

Cloud functions follow this structure:

```javascript
// uniCloud-alipay/cloudfunctions/function-name/index.obj.js
module.exports = {
  async actionName(data) {
    const { token, ...params } = data
    
    // Validate token
    const user = await validateToken(token)
    if (!user) {
      return { code: 401, message: '未授权' }
    }
    
    // Business logic
    const result = await db.collection('cicada_xxx').add(params)
    
    return { code: 0, data: result }
  }
}
```

## Key Conventions

- **Navigation**: All pages use `navigationStyle: "custom"` for custom navigation bars
- **Error Codes**: `code: 0` = success, `code: 401` = unauthorized, other codes = error
- **Token Management**: Token stored in uni.getStorageSync, auto-injected by cloud.js
- **User Roles**: `client` (customer), `engineer` (repair technician), `admin` (system admin)
- **Order Status Flow**: Typically follows a state machine (check order schema for valid transitions)

## Common Tasks

### Adding a New Page (Mini Program)

1. Create Vue component in `pages/category/name.vue`
2. Add route to `pages.json`:
```json
{
  "path": "pages/category/name",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "页面标题"
  }
}
```

### Adding a New Page (PC Admin)

1. Create Vue component in `../pc-admin/src/views/CategoryName.vue`
2. Add route in `../pc-admin/src/router/index.js`:
```javascript
{
  path: '/category-name',
  name: 'CategoryName',
  component: () => import('@/views/CategoryName.vue'),
  meta: { requiresAuth: true, title: '页面标题' }
}
```

### Adding a New Cloud Function

1. Create folder in `uniCloud-alipay/cloudfunctions/function-name/`
2. Create `index.obj.js` with exported methods
3. Add `package.json` if dependencies needed
4. Right-click folder → Upload and deploy

### Adding a New Database Collection

1. Create schema file: `uniCloud-alipay/database/cicada_name.schema.json`
2. Define schema with validation rules
3. Upload schema via HBuilderX or web console
4. Add required indexes (document in INDEX_TASK.md)
5. Create init data file if needed: `cicada_name.init_data.json`

## Testing

- **Test Data**: See `uniCloud-alipay/database/test-*.json` files
- **Import Test Data**: Follow instructions in `导入测试数据说明.md`
- Use WeChat DevTools for debugging Mini Program
- Use browser DevTools for H5 debugging

## Important Notes

- **Project Structure**: This is a multi-repo setup:
  - `E:\yayi\3号\` - Mini Program (this directory)
  - `E:\yayi\pc-admin\` - PC Admin Dashboard (sibling directory)
  - Both share the same uniCloud backend in `uniCloud-alipay/`
- **WeChat AppID**: `wx25289fbe4a3bf011` (configured in manifest.json)
- **Vue Version**: Vue 3 (vueVersion: "3" in manifest.json)
- **uniCloud Provider**: Alipay Cloud (folder: uniCloud-alipay)
- **Rate Limiting**: Implemented via `cicada_rate_limits` collection
- **Order Numbers**: Must be unique (enforced by database unique index)
- **User Roles**: 
  - `client` - Customers using Mini Program
  - `engineer` - Repair technicians using PC Admin
  - `admin` - System administrators using PC Admin
