-- Enable pg_trgm extension for fuzzy/partial matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fast partial + typo search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicle_plate_trgm
  ON "Vehicle" USING gin ("plateNumber" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicle_model_trgm
  ON "Vehicle" USING gin ("model" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_name_trgm
  ON "User" USING gin ("name" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_title_trgm
  ON "Shift" USING gin ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_item_title_trgm
  ON "FeedItem" USING gin ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_thread_title_trgm
  ON "ChatThread" USING gin ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_content_trgm
  ON "ChatMessage" USING gin ("content" gin_trgm_ops);
