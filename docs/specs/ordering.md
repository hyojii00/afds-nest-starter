# Ordering Behavior Specification

## Create an order

`POST /api/v1/orders` accepts a non-empty `customerId`, one three-letter uppercase currency code, and at least one item. Each item requires a non-empty SKU, a positive integer quantity, and a non-negative integer `unitPriceMinor`.

Money is represented in integer minor units. The aggregate calculates the total and creates a `PENDING` order at version 1. The response is `201`; invalid input is `400`. The same transaction inserts `ordering.order.created.v1` into the Outbox.

## Read and transition an order

- `GET /api/v1/orders/:orderId` returns the current snapshot or `404`.
- `POST /api/v1/orders/:orderId/confirm` changes `PENDING` to `CONFIRMED`, increments the version, and records `ordering.order.confirmed.v1`.
- `POST /api/v1/orders/:orderId/cancel` requires a 1–500 character reason, changes `PENDING` to `CANCELLED`, increments the version, and records `ordering.order.cancelled.v1`.
- Confirming or cancelling a non-pending order returns `409`.
- A concurrent write that loses optimistic locking returns `409`.

Order items, customer, currency, and total are immutable after creation. Authentication, payment, inventory, shipping, idempotency keys, and post-confirmation cancellation are outside the current contract.

## Integration event projection

The Outbox worker publishes versioned integration-event envelopes to the configured Kafka topic with the aggregate ID as the record key. An Outbox row becomes `PUBLISHED` only after broker acknowledgement; failed attempts retain the existing retry and terminal-failure behavior.

The order-activity consumer processes `ordering.order.created.v1` and records the event ID, order ID, customer ID, currency, total minor amount, and occurrence time. The event ID uniquely identifies a projection row, so receiving the same event more than once does not create duplicates. Other event types are acknowledged without adding an order-activity row. An invalid `ordering.order.created.v1` payload is not acknowledged and remains available for Kafka redelivery.

## Operational endpoints

- `GET /health/live` returns the Nest Terminus health envelope and reports process liveness without checking dependencies.
- `GET /health/ready` returns the Nest Terminus health envelope, checks PostgreSQL, and returns `503` while unavailable.
- `/docs` and `/docs-json` expose the Swagger UI and OpenAPI document.
