USE educore_db;

CREATE TABLE IF NOT EXISTS activity_logs (
log_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
school_id     BIGINT UNSIGNED NOT NULL,
user_id       BIGINT UNSIGNED,                         -- NULL for system actions
role          VARCHAR(30),
action        VARCHAR(80)  NOT NULL,                   -- e.g. "payment.create"
entity        VARCHAR(60),                             -- e.g. "payment", "student"
entity_id     BIGINT UNSIGNED,                         -- e.g. payment_id
description   VARCHAR(255),                            -- human-readable summary
ip_address    VARCHAR(45),
created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
INDEX idx_school_created (school_id, created_at),
INDEX idx_user           (user_id),
INDEX idx_action         (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;