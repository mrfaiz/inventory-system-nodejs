import type { OrderWithItems } from '../../modules/order/order.repository';
import type { ProductWithInventory } from '../../modules/inventory/inventory.repository';

type DashboardViewModel = {
  products: ProductWithInventory[];
  orders: OrderWithItems[];
  notice?: string;
  error?: string;
  orderDraft?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderDashboard({
  products,
  orders,
  notice,
  error,
  orderDraft = '',
}: DashboardViewModel): string {
  const productCards = products
    .map(
      (product) => `
        <article class="card data-card">
          <div class="data-card__head">
            <div>
              <p class="eyebrow">${escapeHtml(product.sku)}</p>
              <h3>${escapeHtml(product.name)}</h3>
            </div>
            <span class="pill">${product.inventory?.quantity ?? 0} in stock</span>
          </div>
          <p class="muted">${escapeHtml(product.description ?? 'No description')}</p>
          <dl class="meta">
            <div>
              <dt>Product ID</dt>
              <dd>${escapeHtml(product.id)}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>$${(product.priceCents / 100).toFixed(2)}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join('');

  const orderCards = orders
    .map(
      (order) => `
        <article class="card data-card">
          <div class="data-card__head">
            <div>
              <p class="eyebrow">${escapeHtml(order.id)}</p>
              <h3>${escapeHtml(order.status)}</h3>
            </div>
            <span class="pill">$${(order.totalCents / 100).toFixed(2)}</span>
          </div>
          <dl class="meta">
            <div>
              <dt>Create key</dt>
              <dd>${escapeHtml(order.createIdempotencyKey)}</dd>
            </div>
            <div>
              <dt>Cancel key</dt>
              <dd>${escapeHtml(order.cancelIdempotencyKey ?? 'Not cancelled')}</dd>
            </div>
          </dl>
          <div class="items">
            ${order.items
              .map(
                (item) => `
                  <div class="item-row">
                    <span>${escapeHtml(item.product.name)}</span>
                    <span>${item.quantity} x $${(item.priceCents / 100).toFixed(2)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>
        </article>
      `,
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Inventory Console</title>
      <style>
        :root {
          --bg: #f3efe6;
          --panel: rgba(255, 252, 246, 0.9);
          --line: #d7ccb8;
          --text: #201a14;
          --muted: #6f6557;
          --accent: #0f766e;
          --accent-strong: #134e4a;
          --danger: #b42318;
          --shadow: 0 18px 50px rgba(72, 52, 24, 0.12);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          color: var(--text);
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 28%),
            radial-gradient(circle at top right, rgba(180, 35, 24, 0.08), transparent 22%),
            linear-gradient(180deg, #fbf7ee 0%, var(--bg) 100%);
          min-height: 100vh;
        }
        .shell {
          width: min(1200px, calc(100% - 32px));
          margin: 0 auto;
          padding: 32px 0 48px;
        }
        .hero {
          padding: 28px;
          border: 1px solid rgba(32, 26, 20, 0.08);
          background: linear-gradient(135deg, rgba(255, 252, 246, 0.94), rgba(240, 232, 216, 0.88));
          box-shadow: var(--shadow);
          border-radius: 24px;
          margin-bottom: 24px;
        }
        .hero h1 {
          margin: 0 0 8px;
          font-size: clamp(2rem, 4vw, 3.6rem);
          line-height: 0.95;
          letter-spacing: -0.04em;
        }
        .hero p {
          margin: 0;
          max-width: 720px;
          color: var(--muted);
          font-size: 1.05rem;
        }
        .banner {
          padding: 14px 16px;
          border-radius: 16px;
          margin: 0 0 18px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.72);
        }
        .banner--error {
          border-color: rgba(180, 35, 24, 0.25);
          color: var(--danger);
          background: rgba(180, 35, 24, 0.08);
        }
        .grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
        }
        .stack {
          display: grid;
          gap: 18px;
        }
        .card {
          background: var(--panel);
          border: 1px solid rgba(32, 26, 20, 0.08);
          border-radius: 22px;
          box-shadow: var(--shadow);
          padding: 20px;
          backdrop-filter: blur(10px);
        }
        .card h2 {
          margin: 0 0 14px;
          font-size: 1.35rem;
        }
        .forms {
          display: grid;
          gap: 16px;
        }
        form {
          display: grid;
          gap: 12px;
        }
        label {
          display: grid;
          gap: 6px;
          font-size: 0.92rem;
          color: var(--muted);
        }
        input, textarea, button {
          font: inherit;
        }
        input, textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.8);
          color: var(--text);
        }
        textarea {
          min-height: 110px;
          resize: vertical;
        }
        button {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: white;
          cursor: pointer;
          justify-self: start;
        }
        .hint, .muted {
          color: var(--muted);
          font-size: 0.92rem;
        }
        .data-list {
          display: grid;
          gap: 14px;
        }
        .data-card__head {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .data-card h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .eyebrow {
          margin: 0 0 4px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.75rem;
        }
        .pill {
          border-radius: 999px;
          padding: 7px 10px;
          background: rgba(15, 118, 110, 0.1);
          color: var(--accent-strong);
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .meta {
          display: grid;
          gap: 10px;
          margin: 12px 0 0;
        }
        .meta div {
          display: grid;
          gap: 2px;
        }
        .meta dt {
          color: var(--muted);
          font-size: 0.8rem;
        }
        .meta dd {
          margin: 0;
          word-break: break-word;
        }
        .items {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px dashed rgba(32, 26, 20, 0.12);
        }
        @media (max-width: 920px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <h1>Inventory Console</h1>
          <p>Use this page to exercise the backend flows manually: create catalog products, adjust stock, place idempotent orders, and cancel them.</p>
        </section>
        ${notice ? `<div class="banner">${escapeHtml(notice)}</div>` : ''}
        ${error ? `<div class="banner banner--error">${escapeHtml(error)}</div>` : ''}
        <section class="grid">
          <div class="stack">
            <article class="card">
              <h2>Write Operations</h2>
              <div class="forms">
                <form method="post" action="/ui/products">
                  <label>SKU<input name="sku" required /></label>
                  <label>Name<input name="name" required /></label>
                  <label>Description<input name="description" /></label>
                  <label>Price (cents)<input name="priceCents" type="number" min="1" required /></label>
                  <label>Starting stock<input name="stock" type="number" min="0" required /></label>
                  <button type="submit">Create Product</button>
                </form>

                <form method="post" action="/ui/stock">
                  <label>Product ID<input name="productId" required /></label>
                  <label>Delta<input name="delta" type="number" required /></label>
                  <p class="hint">Use positive values to restock and negative values to reserve/reduce stock.</p>
                  <button type="submit">Adjust Stock</button>
                </form>

                <form method="post" action="/ui/orders">
                  <label>Idempotency key<input name="idempotencyKey" required /></label>
                  <label>Items<textarea name="items" required placeholder="product-id,quantity&#10;another-product-id,quantity">${escapeHtml(orderDraft)}</textarea></label>
                  <p class="hint">One item per line. Example: <code>product-id,2</code></p>
                  <button type="submit">Place Order</button>
                </form>

                <form method="post" action="/ui/orders/cancel">
                  <label>Order ID<input name="orderId" required /></label>
                  <label>Cancel idempotency key<input name="idempotencyKey" required /></label>
                  <button type="submit">Cancel Order</button>
                </form>
              </div>
            </article>
          </div>

          <div class="stack">
            <article class="card">
              <h2>Products</h2>
              <div class="data-list">
                ${productCards || '<p class="muted">No products yet.</p>'}
              </div>
            </article>
            <article class="card">
              <h2>Orders</h2>
              <div class="data-list">
                ${orderCards || '<p class="muted">No orders yet.</p>'}
              </div>
            </article>
          </div>
        </section>
      </main>
    </body>
  </html>`;
}
