-- CreateTable
CREATE TABLE `card_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `card_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(1024) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_type` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `card_attachments_card_id_idx`(`card_id`),
    INDEX `card_attachments_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `card_attachments` ADD CONSTRAINT `card_attachments_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_attachments` ADD CONSTRAINT `card_attachments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
