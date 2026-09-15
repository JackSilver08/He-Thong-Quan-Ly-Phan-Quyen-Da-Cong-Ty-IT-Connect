# Database schema

The SQL files in this directory are intended to initialize a fresh PostgreSQL instance in lexical order.

`001_full_schema.sql` creates the normalized core model. `002_seed.sql` adds starter departments for local development.

Production migrations should be promoted to an explicit migration runner before the first live deployment.
