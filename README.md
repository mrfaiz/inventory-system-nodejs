# Inventory System

A TypeScript inventory management backend built with Express, tRPC, Prisma, PostgreSQL, and Vitest.

This project includes:
- MVC-style backend modules
- Prisma schema and SQL migration
- transactional order placement and cancellation
- idempotent order and cancel flows
- Mistral-powered AI product search with tool calling
- unit tests and Docker-backed integration tests via Testcontainers
- a small server-rendered UI for manual testing

## Stack

- TypeScript
- Node.js
- Express
- tRPC
- Prisma ORM
- PostgreSQL
- Docker Compose
- Vitest
- Testcontainers

## Architecture

The codebase follows an MVC-oriented structure for business modules:

- `schema`: validation and input contracts
- `repository`: persistence logic
- `service`: business logic and transactional workflows
- `controller`: request-oriented orchestration
- `router`: tRPC or Express route wiring
- `views`: server-rendered HTML for the manual UI

### Current structure

```text
prisma/
  migrations/
  schema.prisma

scripts/
  seed.ts

src/
  app.ts
  server.ts
  db/
    prisma.ts
  trpc/
    context.ts
    root-router.ts
    trpc.ts
  modules/
    ai-search/
      ai-search.schema.ts
      ai-search.repository.ts
      mistral.client.ts
      ai-search.service.ts
      ai-search.controller.ts
      ai-search.router.ts
    inventory/
      inventory.schema.ts
      inventory.repository.ts
      inventory.service.ts
      inventory.controller.ts
      inventory.router.ts
    order/
      order.schema.ts
      order.repository.ts
      order.service.ts
      order.controller.ts
      order.router.ts
    ui/
      ui.controller.ts
      ui.router.ts
  views/
    ui/
      dashboard.view.ts

tests/
  setup.ts
  unit/
  integration/
```

## Domain Model

The Prisma schema is defined in [prisma/schema.prisma](./prisma/schema.prisma).

### Entities

- `Product`
  - product catalog data such as `sku`, `name`, `description`, and `priceCents`
- `Inventory`
  - separate 1:1 stock table for each product
  - stores current quantity
- `Order`
  - stores status, totals, and idempotency keys
- `OrderItem`
  - links orders to products and records item price/quantity

### Why `Inventory` is separate from `Product`

Catalog information and stock state change at different rates and for different reasons.

Keeping inventory in its own table makes it easier to:
- reason about stock changes independently from product metadata
- extend later with stock movement history, warehouses, or reservations
- keep service and repository responsibilities clearer

## Transactions and Idempotency

The order flow is implemented in [src/modules/order/order.service.ts](./src/modules/order/order.service.ts).

### Order placement

`placeOrder()` runs inside `prisma.$transaction(...)` and:

1. checks whether `createIdempotencyKey` already exists
2. loads all referenced products
3. decrements inventory atomically
4. creates the order and items

If stock decrement fails for any item, the transaction throws and the whole order is rolled back.

### Order cancellation

`cancelOrder()` also runs inside a transaction and:

1. checks whether the cancel idempotency key already exists
2. loads the order and its items
3. restores inventory
4. marks the order as cancelled

If the same cancel request is retried with the same idempotency key, the service returns the already-cancelled result instead of duplicating work.

### Current idempotency strategy

- order creation uses `Order.createIdempotencyKey`
- order cancellation uses `Order.cancelIdempotencyKey`

This is enough for request replay protection in the current single-order workflow.

### Sequence overview

Order placement:

```text
Client
  -> Controller
  -> Service
  -> begin transaction
  -> check createIdempotencyKey
  -> load products and inventory
  -> decrement inventory
  -> create order + order items
  -> commit
  -> response
```

Order cancellation:

```text
Client
  -> Controller
  -> Service
  -> begin transaction
  -> check cancelIdempotencyKey
  -> load order + items
  -> restore inventory
  -> update order status to CANCELLED
  -> commit
  -> response
```

## API Layer

tRPC is configured under [src/trpc](./src/trpc).

### AI Search Overview

The `ai-search` module adds a natural-language product search flow on top of the existing inventory catalog.

It uses Mistral Chat Completions with tool calling in a controlled loop:

1. the user sends a natural-language prompt such as "find wireless keyboards in stock"
2. Mistral decides whether to call the local `search_products` tool
3. the backend executes that tool against the PostgreSQL product catalog
4. the tool result is sent back to Mistral
5. Mistral returns a final answer summarizing the matching products

The current tool set includes:

- `search_products`
  - searches `Product.sku`, `Product.name`, and `Product.description`
  - returns matching products with inventory quantities

Example UI:

![AI Search Example](./ai-search.png)

The implementation is split across:

- [src/modules/ai-search/ai-search.router.ts](./src/modules/ai-search/ai-search.router.ts)
- [src/modules/ai-search/ai-search.controller.ts](./src/modules/ai-search/ai-search.controller.ts)
- [src/modules/ai-search/ai-search.service.ts](./src/modules/ai-search/ai-search.service.ts)
- [src/modules/ai-search/ai-search.repository.ts](./src/modules/ai-search/ai-search.repository.ts)
- [src/modules/ai-search/mistral.client.ts](./src/modules/ai-search/mistral.client.ts)

### Routers

- `inventory.*`
  - list products
  - get product by ID
  - create product
  - adjust stock
- `aiSearch.*`
  - `searchProducts`: Mistral-backed natural language product search using tool calling
- `order.*`
  - list orders
  - get order by ID
  - place order
  - cancel order

The Express app mounts tRPC at:

```text
/trpc
```

### Example tRPC payloads

The routers exposed by this project are:

- `inventory.list`
- `inventory.getById`
- `inventory.create`
- `inventory.adjustStock`
- `aiSearch.searchProducts`
- `order.list`
- `order.getById`
- `order.place`
- `order.cancel`

Search products with AI:

```json
{
  "prompt": "Find keyboards that are in stock"
}
```

Create product:

```json
{
  "sku": "SKU-1001",
  "name": "Keyboard",
  "description": "Mechanical keyboard",
  "priceCents": 12900,
  "stock": 10
}
```

Adjust stock:

```json
{
  "productId": "9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c",
  "delta": -2
}
```

Place order:

```json
{
  "idempotencyKey": "order-001",
  "items": [
    {
      "productId": "9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c",
      "quantity": 2
    }
  ]
}
```

Cancel order:

```json
{
  "orderId": "1ad86a5b-c060-4d26-bf48-e67264395e73",
  "idempotencyKey": "cancel-001"
}
```

### AI Search response shape

`aiSearch.searchProducts` returns:

```json
{
  "answer": "I found Keyboard (SKU-1), priced at 8900 cents with 5 units in stock.",
  "products": [
    {
      "id": "9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c",
      "sku": "SKU-1",
      "name": "Keyboard",
      "description": "Mechanical keyboard",
      "priceCents": 8900,
      "inventory": {
        "quantity": 5
      }
    }
  ]
}
```

## Manual UI

The project includes a small server-rendered UI for manual testing.

### UI routes

- `GET /ui`
- `POST /ui/ai-search`
- `POST /ui/ai-search.json`
- `POST /ui/products`
- `POST /ui/stock`
- `POST /ui/orders`
- `POST /ui/orders/cancel`

### UI responsibilities

- run AJAX-based AI product searches from the dashboard
- create products
- adjust stock
- place orders with idempotency keys
- cancel orders with idempotency keys
- inspect current products and orders

The UI controller lives in [src/modules/ui/ui.controller.ts](./src/modules/ui/ui.controller.ts) and the HTML view is in [src/views/ui/dashboard.view.ts](./src/views/ui/dashboard.view.ts).

### UI walkthrough

After seeding and starting the app, the `/ui` page gives you one place to exercise the main flows:

1. create a product
2. use the Product Chat panel to search products with natural language
3. adjust stock with a positive or negative delta
4. place an order with an idempotency key
5. cancel an order with a cancel idempotency key
6. inspect products and orders on the same page

### AJAX product chat

The `/ui` dashboard includes a Product Chat panel.

- the page stays server-rendered overall
- the AI chat form submits with `fetch(...)` to `POST /ui/ai-search.json`
- the response is rendered inline without a full page refresh
- the fallback `POST /ui/ai-search` route still exists for non-JavaScript form submission

The JSON endpoint returns:

```json
{
  "prompt": "Find keyboards in stock",
  "answer": "I found Keyboard (SKU-1), priced at 8900 cents with 5 units in stock.",
  "products": [
    {
      "id": "9b7cfa2c-e5ef-4db2-9d76-a17d2cc4190c",
      "sku": "SKU-1",
      "name": "Keyboard",
      "description": "Mechanical keyboard",
      "priceCents": 8900,
      "stock": 5
    }
  ]
}
```

Recommended manual checks:

- submit the same order twice with the same idempotency key and confirm only one order is created
- submit the same cancellation twice with the same cancel key and confirm stock is restored only once
- try ordering more stock than available and confirm the order is rejected

## Local Development

### Prerequisites

- Node.js 22+
- Docker
- Docker Compose

### Environment

Create `.env` from `.env.example` if needed.

Current local database URL:

```env
DATABASE_URL="postgresql://inventory:inventory@localhost:5434/inventory_system?schema=public"
PORT=3000
MISTRAL_API_KEY="your-mistral-api-key"
MISTRAL_MODEL="mistral-small-latest"
```

AI search environment variables:

- `MISTRAL_API_KEY`: required for the `aiSearch` module and `/ui` Product Chat
- `MISTRAL_MODEL`: optional, defaults to `mistral-small-latest`
- `MISTRAL_BASE_URL`: optional override for the Mistral API base URL

### Install dependencies

```bash
npm install
```

### Start PostgreSQL

```bash
docker compose up -d --remove-orphans postgres
```

### Apply migrations

```bash
npx prisma migrate deploy
```

### Seed sample data

```bash
npm run seed
```

The seed script creates:
- sample products
- one open order
- one cancelled order

It uses fixed idempotency keys, so rerunning it does not create duplicate sample orders.

### Run the app

```bash
npm run dev
```

Open:

- `http://localhost:3000/ui`
- `http://localhost:3000/health`

## Testing

### Unit tests

Unit tests cover controllers and service logic in isolation.

Run:

```bash
npm test
```

Covered areas include:
- controller validation behavior
- service success/failure paths
- idempotent service behavior

### Integration tests

Integration tests use `@testcontainers/postgresql`, not a dedicated test service in `docker-compose.yml`.

The integration suite:

1. starts an ephemeral PostgreSQL container
2. sets `DATABASE_URL` dynamically
3. runs `prisma migrate deploy`
4. snapshots the migrated database
5. restores the snapshot before each test

Run:

```bash
npm run test:integration
```

Current integration coverage verifies:
- order placement idempotency
- rollback on insufficient stock
- order cancellation idempotency

See [tests/integration/order.service.integration.test.ts](./tests/integration/order.service.integration.test.ts).

## Useful Commands

```bash
npm run dev
npm run build
npm test
npm run test:integration
npm run seed
npx prisma generate
npx prisma migrate deploy
```

## Notes

- Docker Compose is used for the normal local development database
- Testcontainers is used for integration testing
- The project uses server-rendered HTML for manual UI testing, with a small AJAX enhancement for Product Chat
- The inventory/order modules are the main domain slices today, but the structure is ready to grow with more modules
