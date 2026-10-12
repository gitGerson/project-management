-- CreateTable
CREATE TABLE `board_members` (
    `board_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('owner', 'member', 'monitor', 'guest') NOT NULL DEFAULT 'member',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`board_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `board_members` ADD CONSTRAINT `board_members_board_id_fkey` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `board_members` ADD CONSTRAINT `board_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
