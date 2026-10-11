-- AlterTable
ALTER TABLE `users` ADD COLUMN `domain` VARCHAR(191) NULL,
    ADD COLUMN `guid` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_guid_key` ON `users`(`guid`);

