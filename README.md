# Inventory System

A TypeScript inventory management backend built with Express, tRPC, Prisma, PostgreSQL, and Vitest.

This project includes:
- MVC-style backend modules
- Prisma schema and SQL migration
- transactional order placement and cancellation
- idempotent order and cancel flows
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

### Routers

- `inventory.*`
  - list products
  - get product by ID
  - create product
  - adjust stock
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
- `order.list`
- `order.getById`
- `order.place`
- `order.cancel`

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

## Manual UI

The project includes a small server-rendered UI for manual testing.

### UI routes

- `GET /ui`
- `POST /ui/products`
- `POST /ui/stock`
- `POST /ui/orders`
- `POST /ui/orders/cancel`

### UI responsibilities

- create products
- adjust stock
- place orders with idempotency keys
- cancel orders with idempotency keys
- inspect current products and orders

The UI controller lives in [src/modules/ui/ui.controller.ts](./src/modules/ui/ui.controller.ts) and the HTML view is in [src/views/ui/dashboard.view.ts](./src/views/ui/dashboard.view.ts).

### UI walkthrough

After seeding and starting the app, the `/ui` page gives you one place to exercise the main flows:

1. create a product
2. adjust stock with a positive or negative delta
3. place an order with an idempotency key
4. cancel an order with a cancel idempotency key
5. inspect products and orders on the same page

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
```

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
- The project currently uses server-rendered HTML for manual UI testing instead of a separate frontend app
- The inventory/order modules are the main domain slices today, but the structure is ready to grow with more modules
