-- CreateTable
CREATE TABLE `kanban_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `board_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `sort_order` DOUBLE NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kanban_lists_board_id_sort_order_index`(`board_id`, `sort_order`),
    INDEX `kanban_lists_board_id_is_active_index`(`board_id`, `is_active`),
    UNIQUE INDEX `kanban_lists_board_id_code_key`(`board_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing data if old lists table exists
INSERT INTO `kanban_lists` (`id`, `board_id`, `name`, `code`, `sort_order`, `is_active`, `created_at`, `updated_at`)
SELECT `id`, `board_id`, `title`, UPPER(REPLACE(`title`, ' ', '_')), `position`, true, `created_at`, `updated_at`
FROM `lists`;

-- Drop old lists table and its foreign key
ALTER TABLE `lists` DROP FOREIGN KEY `lists_board_id_fkey`;
DROP TABLE `lists`;

-- AddForeignKey
ALTER TABLE `kanban_lists` ADD CONSTRAINT `kanban_lists_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

