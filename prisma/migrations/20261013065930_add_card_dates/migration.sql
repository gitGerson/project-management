-- AlterTable
ALTER TABLE `cards` ADD COLUMN `due_date` DATETIME(3) NULL,
    ADD COLUMN `start_date` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `cards_board_id_due_date_idx` ON `cards`(`board_id`, `due_date`);
