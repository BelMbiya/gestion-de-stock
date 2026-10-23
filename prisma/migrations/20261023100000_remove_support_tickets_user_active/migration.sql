-- Lot 5 : suppression du module Assistance IT et revocation d'acces des comptes.
-- Prealable : `npm run db:support-export` sauvegarde les tickets dans backups/ avant ce script.
-- MySQL n'annule pas le DDL en cas d'echec : l'etape qui peut echouer passe en premier.

-- 1. Journal d'audit : la valeur SUPPORT_TICKET_UPDATE disparait.
-- Echoue (mode strict) si une ligne l'utilise encore, avant toute suppression ; le rapport a blanc le verifie.
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'TRANSFER', 'STATUS_CHANGE', 'INCIDENT_UPDATE', 'SIGN_IN', 'SIGN_OUT') NOT NULL;

-- 2. Revocation d'acces : un compte desactive ne peut plus se connecter, son historique reste.
ALTER TABLE `User` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;

-- 3. Tickets d'assistance : cles etrangeres, puis les mises a jour avant les tickets.
ALTER TABLE `SupportTicketUpdate` DROP FOREIGN KEY `SupportTicketUpdate_ticketId_fkey`;
ALTER TABLE `SupportTicketUpdate` DROP FOREIGN KEY `SupportTicketUpdate_authorId_fkey`;
ALTER TABLE `SupportTicket` DROP FOREIGN KEY `SupportTicket_requesterId_fkey`;
ALTER TABLE `SupportTicket` DROP FOREIGN KEY `SupportTicket_assigneeId_fkey`;
ALTER TABLE `SupportTicket` DROP FOREIGN KEY `SupportTicket_assetId_fkey`;

DROP TABLE `SupportTicketUpdate`;
DROP TABLE `SupportTicket`;
